/**
 * Fixed-capacity ring buffer that reuses slot indices instead of
 * `Array#push` / `Array#shift` (which allocate and trigger GC under load).
 *
 * Prefer constructing with a `factory` so every slot is preallocated and
 * mutated in place via {@link CircularBuffer.claim}.
 */
export class CircularBuffer<T> {
  readonly capacity: number
  private readonly slots: T[]
  private head = 0
  private size = 0

  constructor(capacity: number, factory: () => T) {
    if (!Number.isFinite(capacity) || capacity < 1) {
      throw new Error('CircularBuffer capacity must be a positive integer')
    }

    this.capacity = Math.floor(capacity)
    this.slots = new Array<T>(this.capacity)
    for (let i = 0; i < this.capacity; i += 1) {
      this.slots[i] = factory()
    }
  }

  /** Number of occupied slots. */
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
    const writeIndex = (this.head + this.size) % this.capacity

    if (this.size === this.capacity) {
      this.head = (this.head + 1) % this.capacity
    } else {
      this.size += 1
    }

    return this.slots[writeIndex] as T
  }

  /**
   * Copies up to `max` occupied references into `dest` starting at index 0.
   * Does not allocate; callers should preallocate `dest`.
   * @returns number of items drained
   */
  drainTo(dest: T[], max: number): number {
    const count = Math.min(Math.max(0, max), this.size, dest.length)

    for (let i = 0; i < count; i += 1) {
      dest[i] = this.slots[this.head] as T
      this.head = (this.head + 1) % this.capacity
      this.size -= 1
    }

    return count
  }

  /** Resets read/write pointers without discarding preallocated slots. */
  clear(): void {
    this.head = 0
    this.size = 0
  }
}
