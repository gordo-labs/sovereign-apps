import { TextEncoder } from 'node:util';
import type {
  BootstrapMetadata,
  Clock,
  ClientKeyResolver,
  Observability,
  OriginResolver,
  PresenceCodec,
  PresenceStore,
  RateLimiter,
  SignalingStore,
  WebPresenceLimits,
} from './types.js';
import { DEFAULT_LIMITS } from './types.js';

export class WebPresenceCore<TPresence = unknown, TSignal = unknown> {
  private readonly limits: WebPresenceLimits;
  constructor(
    private readonly options: {
      presence: PresenceStore<TPresence>;
      signaling?: SignalingStore<TSignal>;
      codec: PresenceCodec<TPresence>;
      rateLimiter: RateLimiter;
      clock?: Clock;
      originResolver?: OriginResolver;
      clientKeyResolver?: ClientKeyResolver;
      observability?: Observability;
      limits?: Partial<WebPresenceLimits>;
    },
  ) {
    this.limits = { ...DEFAULT_LIMITS, ...options.limits };
  }
  bootstrap(apiBase: string): BootstrapMetadata {
    const base = apiBase.replace(/\/+$/, '');
    return {
      schemaVersion: 1,
      apiBase: base,
      discovery: [base],
      signaling: [base],
      note: 'Optional untrusted cache. Consumers must verify every record with a key learned during pairing; this helper grants no identity, reachability or authorization.',
    };
  }
  private now() {
    return this.options.clock?.now() ?? Date.now();
  }
  private key(request?: Request) {
    const origin = (request && this.options.originResolver?.(request)) || 'anonymous';
    const client = (request && this.options.clientKeyResolver?.(request)) || 'anonymous';
    return `${origin}:${client}`;
  }
  private reject(reason: string): never {
    this.options.observability?.rejected?.(reason);
    throw new PresenceError(
      reason,
      reason === 'rate_limited' ? 429 : reason === 'too_large' ? 413 : 400,
    );
  }
  private bodySize(value: unknown, signaling = false) {
    let size: number;
    try {
      size = this.options.codec.byteLength?.(value) ?? new TextEncoder().encode(JSON.stringify(value)).byteLength;
    } catch { this.reject('malformed'); }
    if (size > (signaling ? this.limits.maxSignalingBytes : this.limits.maxPresenceBytes))
      this.reject('too_large');
    if (this.hasForbiddenKey(value)) this.reject('forbidden_metadata');
  }
  private hasForbiddenKey(value: unknown): boolean {
    if (!value || typeof value !== 'object') return false;
    if (Array.isArray(value)) return value.some((item) => this.hasForbiddenKey(item));
    return Object.entries(value).some(([key, nested]) => this.limits.forbiddenKeys.has(key) || this.hasForbiddenKey(nested));
  }
  async putPresence(value: unknown, request?: Request, expectedIdentity?: string): Promise<void> {
    this.bodySize(value);
    const now = this.now();
    const verified = this.options.codec.verify(value, { nowMs: now, expectedIdentity });
    if (!this.allow('put', verified.identity, request)) this.reject('rate_limited');
    this.validate(verified, false, request, expectedIdentity ?? verified.identity);
    const accepted = await this.options.presence.putIfNewer(
      verified.identity,
      value as TPresence,
      verified.issuedAtMs,
      verified.expiresAtMs,
    );
    if (!accepted) this.reject('replay');
    this.options.observability?.accepted?.('presence_put', { identity: verified.identity });
  }
  async getPresence(identity: string, request?: Request): Promise<TPresence | undefined> {
    if (!this.allow('get', identity, request)) this.reject('rate_limited');
    await this.options.presence.deleteExpired(this.now(), this.limits.maxDeletesPerRequest);
    return this.options.presence.get(identity);
  }
  async putSignaling(value: unknown, request?: Request, expectedIdentity?: string, expectedSessionId?: string): Promise<void> {
    if (!this.options.signaling || !this.options.codec.verifySignaling)
      this.reject('signaling_unavailable');
    this.bodySize(value, true);
    const now = this.now();
    const verified = this.options.codec.verifySignaling!(value, { nowMs: now, expectedIdentity });
    if (expectedSessionId && verified.sessionId !== expectedSessionId) this.reject('session_mismatch');
    this.validate(verified, true, request, verified.identity);
    const key = `${verified.identity}:${verified.sessionId}`;
    if (!this.allow('signal', key, request)) this.reject('rate_limited');
    const accepted = await this.options.signaling!.append(
      verified.identity,
      verified.sessionId,
      value as TSignal,
      verified.issuedAtMs,
      verified.expiresAtMs,
    );
    if (!accepted) this.reject('store_rejected');
  }
  async getSignaling(
    identity: string,
    sessionId: string,
    sinceIssuedAtMs?: number,
    request?: Request,
  ): Promise<TSignal[]> {
    if (!this.options.signaling) this.reject('signaling_unavailable');
    if (!this.allow('signal-get', `${identity}:${sessionId}`, request)) this.reject('rate_limited');
    await this.options.signaling!.deleteExpired(this.now(), this.limits.maxDeletesPerRequest);
    return this.options.signaling!.list(identity, sessionId, sinceIssuedAtMs);
  }
  private allow(kind: string, identity: string, request?: Request) {
    const key = `${kind}:${identity}:${this.key(request)}`;
    return this.options.rateLimiter.consume(
      key,
      kind === 'get'
        ? this.limits.getPerIdentityPerWindow
        : kind === 'signal' || kind === 'signal-get'
          ? this.limits.signalingPerSessionPerWindow
          : this.limits.putPerIdentityPerWindow,
      this.limits.rateWindowMs,
      this.now(),
    );
  }
  private validate(
    meta: { identity: string; issuedAtMs: number; expiresAtMs: number; candidateCount?: number },
    signaling: boolean,
    request: Request | undefined,
    expectedIdentity?: string,
  ) {
    const now = this.now();
    if (!meta.identity || (expectedIdentity && meta.identity !== expectedIdentity))
      this.reject('identity_mismatch');
    if (
      !Number.isFinite(meta.issuedAtMs) ||
      !Number.isFinite(meta.expiresAtMs) ||
      meta.expiresAtMs <= meta.issuedAtMs ||
      meta.expiresAtMs - meta.issuedAtMs > this.limits.maxTtlMs
    )
      this.reject('invalid_ttl');
    if (
      meta.issuedAtMs > now + this.limits.maxClockSkewMs ||
      meta.expiresAtMs <= now - this.limits.maxClockSkewMs
    )
      this.reject('stale');
    if (!signaling && (meta.candidateCount ?? 0) > this.limits.maxCandidates)
      this.reject('too_many_candidates');
    if (request) {
      const origin = this.options.originResolver?.(request);
      if (origin && origin.length > 2048) this.reject('invalid_origin');
    }
  }
}

export class PresenceError extends Error {
  constructor(
    public readonly reason: string,
    public readonly status: number,
  ) {
    super(reason);
    this.name = 'PresenceError';
  }
}
