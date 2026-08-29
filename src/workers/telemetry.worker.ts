/// <reference lib="webworker" />

/**
 * Telemetry stream Web Worker.
 * Packet generation runs entirely off the main thread.
 * Packets accumulate in a TypedArray SoA ring ({@link TelemetryPacketRing})
 * to avoid GC churn at 10k+ msg/s.
 *
 * Flushing is cadence-throttled (~16ms / 60 FPS) so the main thread receives
 * at most a small number of postMessage payloads per frame — never one
 * message per generated packet.
 */
import type {
  TelemetryPacket,
  WorkerIncomingMessage,
  WorkerOutgoingMessage,
  WorkerStats,
} from '../types/telemetry'
import { TelemetryPacketRing } from '../utils/CircularBuffer'

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

/** Frame-aligned worker cadence (~60 FPS). Generation + flush share this tick. */
const FRAME_INTERVAL_MS = 1000 / 60

/** ~0.8s of headroom at 20,000 msg/sec (rounded up to power-of-two in the ring). */
const PACKET_BUFFER_CAPACITY = 16_384

/** Soft UI-configured batch preference (Control Panel). */
const BATCH_SIZE_MIN = 1
const BATCH_SIZE_MAX = 500

/**
 * Hard safety ceiling for a single postMessage payload.
 * Keeps structured-clone cost bounded on the main thread.
 */
const MAX_PAYLOAD_PACKETS = 512
/** Conservative per-packet byte estimate (strings + numbers after clone). */
const ESTIMATED_PACKET_BYTES = 128
/** Soft byte budget per TELEMETRY_BATCH (~64 KiB). */
const MAX_PAYLOAD_BYTES = 64 * 1024
/** Steady cadence: one batch post per frame tick (drain remaining on STOP). */
const MAX_POSTS_PER_FRAME = 1

function maxPacketsForByteBudget(): number {
  return Math.max(
    1,
    Math.min(
      MAX_PAYLOAD_PACKETS,
      Math.floor(MAX_PAYLOAD_BYTES / ESTIMATED_PACKET_BYTES),
    ),
  )
}

const PAYLOAD_PACKET_CEILING = maxPacketsForByteBudget()

function createEmptyPacket(): TelemetryPacket {
  return {
    timestamp: 0,
    metricName: METRIC_NAMES[0],
    value: 0,
    deviceId: DEVICE_IDS[0],
  }
}

const packetBuffer = new TelemetryPacketRing(PACKET_BUFFER_CAPACITY, {
  metricNames: METRIC_NAMES,
  deviceIds: DEVICE_IDS,
})

/** Reused drain target — mutated in place by TelemetryPacketRing.drainTo. */
const flushScratch: TelemetryPacket[] = new Array(PAYLOAD_PACKET_CEILING)
for (let i = 0; i < PAYLOAD_PACKET_CEILING; i += 1) {
  flushScratch[i] = createEmptyPacket()
}
Object.seal(flushScratch)

let rate = 10_000
let batchSize = 64
let running = false
let timerId: ReturnType<typeof setInterval> | null = null
let lastTickTs = 0
let lastFlushTs = 0
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
    batchSize = Math.max(
      BATCH_SIZE_MIN,
      Math.min(BATCH_SIZE_MAX, Math.round(nextBatchSize)),
    )
  }
}

/**
 * Dynamic flush size for this frame:
 * - at least the configured batchSize preference
 * - at least one frame of ingress (`rate * FRAME_INTERVAL_MS`) so the ring
 *   does not back up under high load
 * - never above the payload safety ceiling
 */
function computeDynamicFlushSize(): number {
  const frameAligned = Math.max(
    1,
    Math.ceil((rate * FRAME_INTERVAL_MS) / 1000),
  )
  const preferred = Math.max(batchSize, frameAligned)
  return Math.min(PAYLOAD_PACKET_CEILING, preferred)
}

function clampPayloadCount(requested: number): number {
  if (requested < 1) return 0
  if (requested > PAYLOAD_PACKET_CEILING) {
    return PAYLOAD_PACKET_CEILING
  }
  return requested
}

/**
 * Cadence-throttled drain → TELEMETRY_BATCH.
 * Under normal ticks, posts at most {@link MAX_POSTS_PER_FRAME} message(s)
 * sized by {@link computeDynamicFlushSize}. On shutdown, drains remaining
 * packets in safe-sized chunks.
 */
function flushBatches(producedAt: number, flushAll: boolean): void {
  if (packetBuffer.isEmpty) return

  const maxPosts = flushAll
    ? Number.POSITIVE_INFINITY
    : MAX_POSTS_PER_FRAME

  let posts = 0

  while (packetBuffer.length > 0 && posts < maxPosts) {
    const requested = flushAll
      ? Math.min(PAYLOAD_PACKET_CEILING, packetBuffer.length)
      : computeDynamicFlushSize()
    const take = clampPayloadCount(
      Math.min(requested, packetBuffer.length, flushScratch.length),
    )
    if (take < 1) break

    const estimatedBytes = take * ESTIMATED_PACKET_BYTES
    if (estimatedBytes > MAX_PAYLOAD_BYTES) {
      post({
        type: 'ERROR',
        code: 'PAYLOAD_LIMIT',
        message: `Refusing TELEMETRY_BATCH of ${take} packets (~${estimatedBytes} B) — exceeds ${MAX_PAYLOAD_BYTES} B safety bound`,
      })
      break
    }

    const count = packetBuffer.drainTo(flushScratch, take)
    if (count === 0) break

    // Shallow view for postMessage length — references preallocated scratch.
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

    posts += 1
    lastFlushTs = producedAt

    if (!flushAll) break
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
  const elapsedMs =
    lastTickTs === 0
      ? FRAME_INTERVAL_MS
      : Math.max(0, now - lastTickTs)
  lastTickTs = now

  const exactCount = (rate * elapsedMs) / 1000 + carry
  let remaining = Math.floor(exactCount)
  carry = exactCount - remaining

  // TypedArray SoA write path — no per-packet object allocation.
  const metricCount = METRIC_NAMES.length
  const deviceCount = DEVICE_IDS.length
  while (remaining > 0) {
    packetBuffer.push({
      timestamp: now,
      metricIndex: seq % metricCount,
      value: Math.random() * 100,
      deviceIndex: seq % deviceCount,
    })
    seq += 1
    remaining -= 1
  }

  // Steady frame-aligned flush — not one postMessage per packet.
  const sinceFlush =
    lastFlushTs === 0 ? FRAME_INTERVAL_MS : now - lastFlushTs
  if (sinceFlush >= FRAME_INTERVAL_MS * 0.9) {
    flushBatches(now, false)
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
  lastFlushTs = 0
  carry = 0
  packetBuffer.clear()
  timerId = setInterval(tick, FRAME_INTERVAL_MS)
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
