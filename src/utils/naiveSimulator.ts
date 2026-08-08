import type { TelemetryPacket } from '../types/telemetry'

export type PacketBatchHandler = (packets: TelemetryPacket[]) => void

export interface NaiveSimulatorOptions {
  /** Target ingress rate in messages per second (100–20_000). */
  rate: number
  /** Max packets emitted per onBatch callback / frame slice. */
  batchSize: number
  /** Invoked on the main thread for every emitted batch. */
  onBatch: PacketBatchHandler
}

const METRIC_NAMES = [
  'cpu.util',
  'mem.rss',
  'disk.io',
  'net.rx',
  'net.tx',
  'temp.celsius',
  'latency.p99',
] as const

const DEVICE_IDS = [
  'dev-alpha-01',
  'dev-bravo-02',
  'dev-charlie-03',
  'dev-delta-04',
  'dev-echo-05',
] as const

const RATE_MIN = 100
const RATE_MAX = 20_000
/** Rates above this threshold enable long-task baseline logging. */
export const HIGH_RATE_THRESHOLD = 5_000
const LONG_TASK_MS = 50

function clampRate(rate: number): number {
  return Math.min(RATE_MAX, Math.max(RATE_MIN, Math.round(rate)))
}

function createPacket(now: number, seq: number): TelemetryPacket {
  return {
    timestamp: now,
    metricName: METRIC_NAMES[seq % METRIC_NAMES.length],
    value: Math.random() * 100,
    deviceId: DEVICE_IDS[seq % DEVICE_IDS.length],
  }
}

function measureBetween(
  measureName: string,
  startMark: string,
  endMark: string,
): number {
  performance.mark(endMark)
  try {
    performance.measure(measureName, startMark, endMark)
    const entries = performance.getEntriesByName(measureName, 'measure')
    const last = entries[entries.length - 1]
    return last?.duration ?? 0
  } catch {
    return 0
  } finally {
    performance.clearMarks(startMark)
    performance.clearMarks(endMark)
    performance.clearMeasures(measureName)
  }
}

function logLongTask(
  source: string,
  durationMs: number,
  detail: Record<string, number | string>,
): void {
  if (durationMs < LONG_TASK_MS) return

  const event = {
    type: 'telemetry.long-task' as const,
    source,
    durationMs: Number(durationMs.toFixed(2)),
    thresholdMs: LONG_TASK_MS,
    ...detail,
    at: new Date().toISOString(),
  }

  console.warn('[NaiveSimulator] main-thread long task', event)
}

/**
 * Main-thread telemetry generator.
 * Intentionally blocks the UI path: each batch is produced with rAF/setInterval
 * and delivered synchronously so React can be forced to re-render immediately.
 *
 * ---------------------------------------------------------------------------
 * Observed baseline metrics (naive path, no worker offload)
 * ---------------------------------------------------------------------------
 * Under ~10,000 msg/sec load with flushSync React updates + Canvas redraw:
 *   - FPS drops to roughly 10–50 FPS (well below the 60 FPS target)
 *   - Main Thread Blocking spikes up to ~100ms (long tasks / jank visible)
 *
 * Use these numbers as the before-optimization baseline when comparing against
 * Web Worker / OffscreenCanvas modes in benchmarks.
 * ---------------------------------------------------------------------------
 */
export class NaiveSimulator {
  private rate: number
  private batchSize: number
  private onBatch: PacketBatchHandler
  private running = false
  private rafId: number | null = null
  private lastFrameTs = 0
  private carry = 0
  private seq = 0
  private frameIndex = 0

  constructor(options: NaiveSimulatorOptions) {
    this.rate = clampRate(options.rate)
    this.batchSize = Math.max(1, Math.round(options.batchSize))
    this.onBatch = options.onBatch
  }

  start(): void {
    if (this.running || typeof window === 'undefined') return
    this.running = true
    this.lastFrameTs = performance.now()
    this.carry = 0
    this.frameIndex = 0
    performance.mark('naive-sim:start')
    this.scheduleFrame()
  }

  stop(): void {
    this.running = false
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
    this.lastFrameTs = 0
    this.carry = 0
    performance.mark('naive-sim:stop')
    try {
      performance.measure('naive-sim:session', 'naive-sim:start', 'naive-sim:stop')
    } catch {
      // start mark may be missing if stop is called before start completes
    }
    performance.clearMarks('naive-sim:start')
    performance.clearMarks('naive-sim:stop')
    performance.clearMeasures('naive-sim:session')
  }

  updateRate(rate: number): void {
    this.rate = clampRate(rate)
  }

  updateBatchSize(batchSize: number): void {
    this.batchSize = Math.max(1, Math.round(batchSize))
  }

  isRunning(): boolean {
    return this.running
  }

  getRate(): number {
    return this.rate
  }

  private scheduleFrame(): void {
    this.rafId = requestAnimationFrame((ts) => this.tick(ts))
  }

  private tick(now: number): void {
    if (!this.running) return

    const frameId = this.frameIndex
    this.frameIndex += 1
    const profileHighRate = this.rate > HIGH_RATE_THRESHOLD
    const frameStartMark = `naive-sim:frame-start:${frameId}`
    const frameEndMark = `naive-sim:frame-end:${frameId}`

    performance.mark(frameStartMark)

    const elapsedMs = Math.max(0, now - this.lastFrameTs)
    this.lastFrameTs = now

    // How many packets this frame should emit to match the target rate.
    const exactCount = (this.rate * elapsedMs) / 1000 + this.carry
    let remaining = Math.floor(exactCount)
    this.carry = exactCount - remaining

    let batchesEmitted = 0
    let packetsEmitted = 0

    // Emit one or more batches synchronously on the main thread.
    while (remaining > 0) {
      const size = Math.min(this.batchSize, remaining)
      const packets = this.createBatch(size, now, frameId, batchesEmitted)
      this.onBatch(packets)
      remaining -= size
      batchesEmitted += 1
      packetsEmitted += size
    }

    const frameDuration = measureBetween(
      `naive-sim:frame:${frameId}`,
      frameStartMark,
      frameEndMark,
    )

    if (profileHighRate) {
      logLongTask('naiveSimulator.tick', frameDuration, {
        rate: this.rate,
        batchSize: this.batchSize,
        batchesEmitted,
        packetsEmitted,
        frameId,
      })
    }

    this.scheduleFrame()
  }

  private createBatch(
    size: number,
    now: number,
    frameId: number,
    batchIndex: number,
  ): TelemetryPacket[] {
    const startMark = `naive-sim:batch-start:${frameId}:${batchIndex}`
    const endMark = `naive-sim:batch-end:${frameId}:${batchIndex}`
    performance.mark(startMark)

    const packets: TelemetryPacket[] = new Array(size)
    for (let i = 0; i < size; i += 1) {
      packets[i] = createPacket(now, this.seq)
      this.seq += 1
    }

    const duration = measureBetween(
      `naive-sim:batch:${frameId}:${batchIndex}`,
      startMark,
      endMark,
    )

    if (this.rate > HIGH_RATE_THRESHOLD) {
      logLongTask('naiveSimulator.createBatch', duration, {
        rate: this.rate,
        size,
        frameId,
        batchIndex,
      })
    }

    return packets
  }
}
