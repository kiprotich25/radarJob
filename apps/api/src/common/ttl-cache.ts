/** Small in-memory TTL cache with a size cap (oldest entries evicted first). */
export class TtlCache<V> {
  private readonly map = new Map<string, { value: V; expiresAt: number }>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries = 500,
    private readonly now: () => number = Date.now,
  ) {}

  get(key: string): V | undefined {
    const hit = this.map.get(key);
    if (!hit) return undefined;
    if (hit.expiresAt <= this.now()) {
      this.map.delete(key);
      return undefined;
    }
    return hit.value;
  }

  set(key: string, value: V): void {
    if (this.ttlMs <= 0) return;
    this.map.delete(key);
    this.map.set(key, { value, expiresAt: this.now() + this.ttlMs });
    while (this.map.size > this.maxEntries) {
      const oldest = this.map.keys().next().value;
      if (oldest === undefined) break;
      this.map.delete(oldest);
    }
  }

  clear(): void {
    this.map.clear();
  }
}

/** Collapse concurrent identical requests into one in-flight promise. */
export class InFlight<V> {
  private readonly pending = new Map<string, Promise<V>>();

  run(key: string, task: () => Promise<V>): Promise<V> {
    const existing = this.pending.get(key);
    if (existing) return existing;
    const p = task().finally(() => this.pending.delete(key));
    this.pending.set(key, p);
    return p;
  }
}
