/// <reference lib="webworker" />

/**
 * Telemetry stream Web Worker.
 * Packet generation runs entirely off the main thread.
 */
import type {
  TelemetryPacket,
  WorkerIncomingMessage,
  WorkerOutgoingMessage,
  WorkerStats,
} from '../types/telemetry'

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
/** Approximate frame cadence inside the worker (rAF is unavailable here). */
const TICK_MS = 16

let rate = 10_000
let batchSize = 64
let running = false
let timerId: ReturnType<typeof setInterval> | null = null
let lastTickTs = 0
let carry = 0
let seq = 0
let packetsEmitted = 0

const ctx: DedicatedWorkerGlobalScope =
  self as unknown as DedicatedWorkerGlobalScope

function clampRate(next: number): number {
  return Math.min(RATE_MAX, Math.max(RATE_MIN, Math.round(next)))
}

function post(message: WorkerOutgoingMessage): void {
  ctx.postMessage(message satisfies WorkerOutgoingMessage)
}

function createPacket(now: number, sequence: number): TelemetryPacket {
  return {
    timestamp: now,
    metricName: METRIC_NAMES[sequence % METRIC_NAMES.length],
    value: Math.random() * 100,
    deviceId: DEVICE_IDS[sequence % DEVICE_IDS.length],
  }
}

function createBatch(size: number, now: number): TelemetryPacket[] {
  const packets: TelemetryPacket[] = new Array(size)
  for (let i = 0; i < size; i += 1) {
    packets[i] = createPacket(now, seq)
    seq += 1
  }
  return packets
}

function currentStats(): WorkerStats {
  return {
    running,
    rate,
    batchSize,
    packetsEmitted,
  }
}

function postStats(): void {
  post({
    type: 'WORKER_STATS',
    stats: currentStats(),
  })
}

function applyConfig(nextRate?: number, nextBatchSize?: number): void {
  if (typeof nextRate === 'number') {
    rate = clampRate(nextRate)
  }
  if (typeof nextBatchSize === 'number') {
    batchSize = Math.max(1, Math.round(nextBatchSize))
  }
}

function stopStream(): void {
  running = false
  if (timerId !== null) {
    clearInterval(timerId)
    timerId = null
  }
  lastTickTs = 0
  carry = 0
  postStats()
}

function tick(): void {
  if (!running) return

  const now = performance.now()
  const elapsedMs = lastTickTs === 0 ? TICK_MS : Math.max(0, now - lastTickTs)
  lastTickTs = now

  const exactCount = (rate * elapsedMs) / 1000 + carry
  let remaining = Math.floor(exactCount)
  carry = exactCount - remaining

  while (remaining > 0) {
    const size = Math.min(batchSize, remaining)
    const packets = createBatch(size, now)
    packetsEmitted += packets.length

    const batchMessage: WorkerOutgoingMessage = {
      type: 'TELEMETRY_BATCH',
      packets,
      producedAt: now,
      packetCount: packets.length,
    }
    post(batchMessage)
    remaining -= size
  }
}

function startStream(nextRate?: number, nextBatchSize?: number): void {
  applyConfig(nextRate, nextBatchSize)

  if (running) {
    postStats()
    return
  }

  running = true
  lastTickTs = performance.now()
  carry = 0
  timerId = setInterval(tick, TICK_MS)
  postStats()
}

function handleIncoming(message: WorkerIncomingMessage): void {
  switch (message.type) {
    case 'START':
      startStream(message.rate, message.batchSize)
      break
    case 'STOP':
      stopStream()
      break
    case 'CONFIG_CHANGE':
      applyConfig(message.rate, message.batchSize)
      postStats()
      break
    default: {
      const _exhaustive: never = message
      post({
        type: 'ERROR',
        code: 'UNKNOWN_MESSAGE',
        message: `Unknown worker control message: ${JSON.stringify(_exhaustive)}`,
      })
    }
  }
}

ctx.onmessage = (event: MessageEvent<WorkerIncomingMessage>) => {
  const message = event.data

  if (!message || typeof message !== 'object' || !('type' in message)) {
    post({
      type: 'ERROR',
      code: 'INVALID_PAYLOAD',
      message: 'WorkerIncomingMessage payload is missing a type discriminant',
    })
    return
  }

  handleIncoming(message)
}

postStats()
