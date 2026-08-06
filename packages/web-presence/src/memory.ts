import type { PresenceStore, RateLimiter, SignalingStore } from './types.js';

/** Development/test adapter only. Do not use for multi-instance production. */
export class MemoryPresenceStore<T> implements PresenceStore<T> {
  private readonly records = new Map<
    string,
    { record: T; issuedAtMs: number; expiresAtMs: number }
  >();
  get(identity: string): T | undefined {
    return this.records.get(identity)?.record;
  }
  putIfNewer(identity: string, record: T, issuedAtMs: number, expiresAtMs: number): boolean {
    const old = this.records.get(identity);
    if (old && issuedAtMs <= old.issuedAtMs) return false;
    this.records.set(identity, { record, issuedAtMs, expiresAtMs });
    return true;
  }
  deleteExpired(nowMs: number, maxDeletes: number): number {
    let n = 0;
    for (const [key, value] of this.records) {
      if (n >= maxDeletes) break;
      if (value.expiresAtMs <= nowMs) {
        this.records.delete(key);
        n++;
      }
    }
    return n;
  }
}

/** Development/test adapter only. Production must provide an atomic durable implementation. */
export class MemorySignalingStore<T> implements SignalingStore<T> {
  private readonly records = new Map<
    string,
    Array<{ record: T; issuedAtMs: number; expiresAtMs: number }>
  >();
  list(identity: string, sessionId: string, sinceIssuedAtMs = -Infinity, nowMs = Date.now()): T[] {
    return (this.records.get(`${identity}:${sessionId}`) ?? [])
      .filter((x) => x.expiresAtMs > nowMs && x.issuedAtMs > sinceIssuedAtMs)
      .map((x) => x.record);
  }
  append(
    identity: string,
    sessionId: string,
    record: T,
    issuedAtMs: number,
    expiresAtMs: number,
  ): boolean {
    const key = `${identity}:${sessionId}`;
    const list = this.records.get(key) ?? [];
    if (list.length >= 200) list.shift();
    list.push({ record, issuedAtMs, expiresAtMs });
    this.records.set(key, list);
    return true;
  }
  deleteExpired(nowMs: number, maxDeletes: number): number {
    let n = 0;
    for (const [key, list] of this.records) {
      const next = list.filter((x) => x.expiresAtMs > nowMs);
      n += list.length - next.length;
      if (next.length) this.records.set(key, next);
      else this.records.delete(key);
      if (n >= maxDeletes) break;
    }
    return n;
  }
}

export class MemoryRateLimiter implements RateLimiter {
  private readonly buckets = new Map<string, { start: number; count: number }>();
  consume(key: string, limit: number, windowMs: number, nowMs: number): boolean {
    const old = this.buckets.get(key);
    const bucket = !old || nowMs - old.start >= windowMs ? { start: nowMs, count: 0 } : old;
    if (bucket.count >= limit) return false;
    bucket.count++;
    this.buckets.set(key, bucket);
    return true;
  }
}
