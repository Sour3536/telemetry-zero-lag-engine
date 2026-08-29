/**
 * Fixed-capacity ring buffer utilities for high-throughput streaming.
 *
 * Design goals (10k+ msg/s):
 * - Power-of-two capacity + bitmask wrap (no `%` on the hot path)
 * - Preallocated storage — no `push` / `shift`
 * - Telemetry hot path uses Structure-of-Arrays TypedArrays so numeric
 *   fields never allocate per message; object views are only mutated
 *   into a reused scratch pool when draining
 */

function nextPowerOfTwo(value: number): number {
  if (value < 1) return 1
  let v = Math.floor(value)
  v -= 1
  v |= v >> 1
  v |= v >> 2
  v |= v >> 4
  v |= v >> 8
  v |= v >> 16
  v |= v >> 32
  return v + 1
}

/**
 * Generic object-slot ring. Slots are preallocated via `factory` and reused
 * through {@link CircularBuffer.claim}. Prefer {@link TelemetryPacketRing}
 * for numeric telemetry streams.
 */
export class CircularBuffer<T> {
  readonly capacity: number
  private readonly mask: number
  private readonly slots: T[]
  private head = 0
  private size = 0

  constructor(capacity: number, factory: () => T) {
    if (!Number.isFinite(capacity) || capacity < 1) {
      throw new Error('CircularBuffer capacity must be a positive integer')
    }

    this.capacity = nextPowerOfTwo(capacity)
    this.mask = this.capacity - 1
    this.slots = new Array<T>(this.capacity)

    for (let i = 0; i < this.capacity; i += 1) {
      this.slots[i] = factory()
    }

    // Prevent accidental growth of the backing store under pressure.
    Object.seal(this.slots)
  }

  get length(): number {
    return this.size
  }

  get isEmpty(): boolean {
    return this.size === 0
  }

  get isFull(): boolean {
    return this.size === this.capacity
  }

  /**
   * Returns the next writable slot, advancing the ring.
   * When full, the oldest entry is overwritten (drop-oldest policy).
   */
  claim(): T {
    const writeIndex = (this.head + this.size) & this.mask

    if (this.size === this.capacity) {
      this.head = (this.head + 1) & this.mask
    } else {
      this.size += 1
    }

    return this.slots[writeIndex] as T
  }

  /**
   * Copies up to `max` occupied references into `dest` starting at index 0.
   * Does not allocate; callers should preallocate `dest`.
   */
  drainTo(dest: T[], max: number): number {
    const count = Math.min(Math.max(0, max), this.size, dest.length)

    for (let i = 0; i < count; i += 1) {
      dest[i] = this.slots[this.head] as T
      this.head = (this.head + 1) & this.mask
      this.size -= 1
    }

    return count
  }

  clear(): void {
    this.head = 0
    this.size = 0
  }
}

/** Compact numeric encoding for TelemetryPacket categorical fields. */
export interface TelemetryRingCodec {
  metricNames: readonly string[]
  deviceIds: readonly string[]
}

export interface TelemetryRingWrite {
  timestamp: number
  metricIndex: number
  value: number
  deviceIndex: number
}

/**
 * Structure-of-Arrays ring for {@link import('../types/telemetry').TelemetryPacket}.
 *
 * Numeric columns live in TypedArrays; metric/device are stored as Uint8
 * indices into a fixed codec table. Draining mutates preallocated packet
 * objects in place — no per-message object allocation on the write path.
 */
export class TelemetryPacketRing {
  readonly capacity: number
  private readonly mask: number
  private readonly timestamps: Float64Array
  private readonly values: Float64Array
  private readonly metricIds: Uint8Array
  private readonly deviceIds: Uint8Array
  private readonly codec: TelemetryRingCodec
  private head = 0
  private size = 0

  constructor(capacity: number, codec: TelemetryRingCodec) {
    if (!Number.isFinite(capacity) || capacity < 1) {
      throw new Error('TelemetryPacketRing capacity must be a positive integer')
    }
    if (codec.metricNames.length < 1 || codec.deviceIds.length < 1) {
      throw new Error('TelemetryPacketRing codec tables must be non-empty')
    }
    if (codec.metricNames.length > 255 || codec.deviceIds.length > 255) {
      throw new Error('TelemetryPacketRing codec tables must fit in Uint8')
    }

    this.capacity = nextPowerOfTwo(capacity)
    this.mask = this.capacity - 1
    this.codec = codec
    this.timestamps = new Float64Array(this.capacity)
    this.values = new Float64Array(this.capacity)
    this.metricIds = new Uint8Array(this.capacity)
    this.deviceIds = new Uint8Array(this.capacity)
  }

  get length(): number {
    return this.size
  }

  get isEmpty(): boolean {
    return this.size === 0
  }

  get isFull(): boolean {
    return this.size === this.capacity
  }

  /**
   * Writes one sample into the next ring slot (drop-oldest when full).
   * Hot path — no heap allocation.
   */
  push(sample: TelemetryRingWrite): void {
    const writeIndex = (this.head + this.size) & this.mask

    this.timestamps[writeIndex] = sample.timestamp
    this.values[writeIndex] = sample.value
    this.metricIds[writeIndex] = sample.metricIndex & 0xff
    this.deviceIds[writeIndex] = sample.deviceIndex & 0xff

    if (this.size === this.capacity) {
      this.head = (this.head + 1) & this.mask
    } else {
      this.size += 1
    }
  }

  /**
   * Materializes up to `max` packets into a preallocated `dest` pool by
   * mutating fields in place. Returns the number of packets filled.
   */
  drainTo(
    dest: Array<{
      timestamp: number
      metricName: string
      value: number
      deviceId: string
    }>,
    max: number,
  ): number {
    const count = Math.min(Math.max(0, max), this.size, dest.length)
    const metrics = this.codec.metricNames
    const devices = this.codec.deviceIds

    for (let i = 0; i < count; i += 1) {
      const index = this.head
      const packet = dest[i]
      if (!packet) break

      packet.timestamp = this.timestamps[index] as number
      packet.value = this.values[index] as number
      packet.metricName =
        metrics[(this.metricIds[index] as number) % metrics.length] ?? metrics[0]
      packet.deviceId =
        devices[(this.deviceIds[index] as number) % devices.length] ?? devices[0]

      this.head = (this.head + 1) & this.mask
      this.size -= 1
    }

    return count
  }

  clear(): void {
    this.head = 0
    this.size = 0
  }
}
