/**
 * Integration boundary for SA-002. The presence package deliberately does not
 * redefine the protocol wire schema or cryptography: applications inject the
 * canonical validator/verifier from @sovereign-apps/protocol.
 */
export type PresenceMetadata = {
  identity: string;
  issuedAtMs: number;
  expiresAtMs: number;
  candidateCount?: number;
};

export type VerificationResult = PresenceMetadata & { canonical?: Uint8Array };

export type PresenceCodec<T = unknown> = {
  verify(value: unknown, context: { nowMs: number; expectedIdentity?: string }): VerificationResult;
  verifySignaling?(
    value: unknown,
    context: { nowMs: number; expectedIdentity?: string },
  ): VerificationResult & { sessionId: string };
  byteLength?(value: unknown): number;
};

export type PresenceStore<T = unknown> = {
  get(identity: string): Promise<T | undefined> | T | undefined;
  putIfNewer(
    identity: string,
    record: T,
    issuedAtMs: number,
    expiresAtMs: number,
  ): Promise<boolean> | boolean;
  deleteExpired(nowMs: number, maxDeletes: number): Promise<number> | number;
};

export type SignalingStore<T = unknown> = {
  list(identity: string, sessionId: string, sinceIssuedAtMs?: number): Promise<T[]> | T[];
  append(
    identity: string,
    sessionId: string,
    record: T,
    issuedAtMs: number,
    expiresAtMs: number,
  ): Promise<boolean> | boolean;
  deleteExpired(nowMs: number, maxDeletes: number): Promise<number> | number;
};

export type RateLimiter = {
  consume(key: string, limit: number, windowMs: number, nowMs: number): Promise<boolean> | boolean;
};
export type Clock = { now(): number };
export type OriginResolver = (request: Request) => string;
export type ClientKeyResolver = (request: Request) => string;
export type Observability = {
  accepted?(event: string, fields?: Record<string, unknown>): void;
  rejected?(reason: string, fields?: Record<string, unknown>): void;
};

export type WebPresenceLimits = {
  maxPresenceBytes: number;
  maxSignalingBytes: number;
  maxTtlMs: number;
  maxClockSkewMs: number;
  maxCandidates: number;
  maxSignalingPerSession: number;
  maxDeletesPerRequest: number;
  forbiddenKeys: ReadonlySet<string>;
  putPerIdentityPerWindow: number;
  getPerIdentityPerWindow: number;
  signalingPerSessionPerWindow: number;
  rateWindowMs: number;
};

export const DEFAULT_LIMITS: WebPresenceLimits = {
  maxPresenceBytes: 64 * 1024,
  maxSignalingBytes: 256 * 1024,
  maxTtlMs: 120_000,
  maxClockSkewMs: 30_000,
  maxCandidates: 16,
  maxSignalingPerSession: 200,
  maxDeletesPerRequest: 100,
  forbiddenKeys: new Set(['password', 'secret', 'privateKey', 'token', 'authorization', 'cookie']),
  putPerIdentityPerWindow: 2,
  getPerIdentityPerWindow: 10,
  signalingPerSessionPerWindow: 120,
  rateWindowMs: 60_000,
};

export type BootstrapMetadata = {
  schemaVersion: 1;
  apiBase: string;
  discovery: string[];
  signaling: string[];
  note: string;
};
