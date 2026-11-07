/** Bounded-concurrency gate with a queue limit, used to protect paid APIs. */
export class Semaphore {
  private active = 0;
  private readonly waiters: Array<() => void> = [];

  constructor(
    private readonly max: number,
    private readonly maxQueued: number,
  ) {}

  /** Returns false (without waiting) when the queue is full. */
  tryEnqueue(): boolean {
    return this.active < this.max || this.waiters.length < this.maxQueued;
  }

  async acquire(): Promise<() => void> {
    if (this.active < this.max) {
      this.active++;
      return () => this.release();
    }
    await new Promise<void>((resolve) => this.waiters.push(resolve));
    this.active++;
    return () => this.release();
  }

  private release() {
    this.active--;
    const next = this.waiters.shift();
    if (next) next();
  }
}

/**
 * Sliding-window rate limiter for outbound provider calls
 * (e.g. the VirusTotal public API allows 4 requests per minute).
 */
export class SlidingWindowLimiter {
  private readonly stamps: number[] = [];

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  /** Milliseconds until a slot frees up (0 = available now). */
  waitTime(): number {
    const t = this.now();
    while (this.stamps.length && this.stamps[0] <= t - this.windowMs) this.stamps.shift();
    if (this.stamps.length < this.limit) return 0;
    return this.stamps[0] + this.windowMs - t;
  }

  take(): boolean {
    if (this.waitTime() > 0) return false;
    this.stamps.push(this.now());
    return true;
  }
}
