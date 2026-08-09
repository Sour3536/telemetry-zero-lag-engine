/// <reference lib="webworker" />

/**
 * Telemetry stream Web Worker.
 * Packet generation runs entirely off the main thread.
 * Packets accumulate in a preallocated CircularBuffer to avoid GC churn.
 */
import type {
  TelemetryPacket,
  WorkerIncomingMessage,
  WorkerOutgoingMessage,
  WorkerStats,
} from '../types/telemetry'
import { CircularBuffer } from '../utils/CircularBuffer'

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
/**
 * ~0.8s of headroom at 20,000 msg/sec. Power-of-two optional; modulo is fine
 * at this size and keeps capacity explicit for profiling.
 */
const PACKET_BUFFER_CAPACITY = 16_384
const MAX_BATCH_SIZE = 500

function createEmptyPacket(): TelemetryPacket {
  return {
    timestamp: 0,
    metricName: METRIC_NAMES[0],
    value: 0,
    deviceId: DEVICE_IDS[0],
  }
}

const packetBuffer = new CircularBuffer<TelemetryPacket>(
  PACKET_BUFFER_CAPACITY,
  createEmptyPacket,
)

/** Reused drain target — length is fixed; only indices `[0, n)` are published. */
const flushScratch: TelemetryPacket[] = new Array(MAX_BATCH_SIZE)
for (let i = 0; i < MAX_BATCH_SIZE; i += 1) {
  flushScratch[i] = createEmptyPacket()
}

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

function writePacket(slot: TelemetryPacket, now: number, sequence: number): void {
  slot.timestamp = now
  slot.metricName = METRIC_NAMES[sequence % METRIC_NAMES.length]
  slot.value = Math.random() * 100
  slot.deviceId = DEVICE_IDS[sequence % DEVICE_IDS.length]
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
    batchSize = Math.max(1, Math.min(MAX_BATCH_SIZE, Math.round(nextBatchSize)))
  }
}

/**
 * Drain the ring into flushScratch and post a TELEMETRY_BATCH.
 * Builds a length-exact packets array of reused slot references; structured
 * clone on postMessage copies values so ring slots remain worker-owned.
 */
function flushBatches(producedAt: number, flushAll: boolean): void {
  const limit = Math.max(1, batchSize)

  while (
    packetBuffer.length >= limit ||
    (flushAll && packetBuffer.length > 0)
  ) {
    const take = Math.min(limit, packetBuffer.length, flushScratch.length)
    const count = packetBuffer.drainTo(flushScratch, take)
    if (count === 0) break

    const packets: TelemetryPacket[] = new Array(count)
    for (let i = 0; i < count; i += 1) {
      packets[i] = flushScratch[i] as TelemetryPacket
    }

    packetsEmitted += count
    post({
      type: 'TELEMETRY_BATCH',
      packets,
      producedAt,
      packetCount: count,
    })

    if (!flushAll && packetBuffer.length < limit) break
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
  flushBatches(performance.now(), true)
  packetBuffer.clear()
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

  // Accumulate into the preallocated ring — no per-packet object allocation.
  while (remaining > 0) {
    const slot = packetBuffer.claim()
    writePacket(slot, now, seq)
    seq += 1
    remaining -= 1
  }

  flushBatches(now, false)
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
  packetBuffer.clear()
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
