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

/**
 * Main-thread telemetry generator.
 * Intentionally blocks the UI path: each batch is produced with rAF/setInterval
 * and delivered synchronously so React can be forced to re-render immediately.
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

    const elapsedMs = Math.max(0, now - this.lastFrameTs)
    this.lastFrameTs = now

    // How many packets this frame should emit to match the target rate.
    const exactCount = (this.rate * elapsedMs) / 1000 + this.carry
    let remaining = Math.floor(exactCount)
    this.carry = exactCount - remaining

    // Emit one or more batches synchronously on the main thread.
    while (remaining > 0) {
      const size = Math.min(this.batchSize, remaining)
      const packets = this.createBatch(size, now)
      this.onBatch(packets)
      remaining -= size
    }

    this.scheduleFrame()
  }

  private createBatch(size: number, now: number): TelemetryPacket[] {
    const packets: TelemetryPacket[] = new Array(size)
    for (let i = 0; i < size; i += 1) {
      packets[i] = createPacket(now, this.seq)
      this.seq += 1
    }
    return packets
  }
}
