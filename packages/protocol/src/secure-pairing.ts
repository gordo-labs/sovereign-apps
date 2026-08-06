import { canonicalJson } from './schemas.js';
import type { PeerCapability } from './pairing.js';

/** Domain separator for the only signature transcript accepted by the template. */
export const PAIRING_TRANSCRIPT_DOMAIN = 'sovereign-apps/pairing-transcript/v1';
export const SECURE_PAIRING_VERSION = 2 as const;
export const MAX_PAIRING_INPUT_BYTES = 4096;
export const ACCESS_GRANT_TTL_MS = 10 * 60_000;
export const REFRESH_GRANT_TTL_MS = 30 * 24 * 60 * 60_000;

export type SecurePairingQrEnvelope = {
  v: typeof SECURE_PAIRING_VERSION;
  kind: 'sovereign-pairing';
  protocol: 'sovereign-apps/1';
  alpn: string;
  hubId: string;
  nodeId: string;
  desktopPublicKey: string;
  sessionRef: string;
  expiresAt: string;
  bootstrap?: string;
};

export type PairingCapabilities = ReadonlyArray<PeerCapability>;

export type PairingTranscript = {
  domain: typeof PAIRING_TRANSCRIPT_DOMAIN;
  protocol: string;
  alpn: string;
  desktopPublicKey: string;
  desktopNodeId: string;
  mobilePublicKey: string;
  nonce: string;
  expiresAt: string;
  requested: PairingCapabilities;
  granted: PairingCapabilities;
};

export type PairingGrant = {
  id: string;
  peerKey: string;
  nodeId: string;
  accessToken: string;
  refreshToken: string;
  capabilities: PeerCapability[];
  issuedAt: string;
  expiresAt: string;
  refreshExpiresAt: string;
  rotation: number;
  revokedAt?: string;
};

export type PairingSession = {
  sessionRef: string;
  expiresAt: number;
  consumed: boolean;
  attempts: number;
  createdAt: number;
};

const b64url = (bytes: Uint8Array): string => Buffer.from(bytes).toString('base64url');
const decode = (value: string): Uint8Array => new Uint8Array(Buffer.from(value, 'base64url'));

/** CSPRNG only. There is intentionally no Math.random fallback. */
export function secureRandom(bytes = 32): Uint8Array {
  if (!Number.isInteger(bytes) || bytes < 16 || bytes > 1024)
    throw new Error('Invalid random size');
  const source = globalThis.crypto;
  if (!source || typeof source.getRandomValues !== 'function')
    throw new Error('Secure randomness unavailable');
  try {
    return source.getRandomValues(new Uint8Array(bytes));
  } catch (error) {
    throw new Error(
      `Secure randomness unavailable: ${error instanceof Error ? error.message : 'unknown error'}`,
    );
  }
}

export function createSessionRef(): string {
  return b64url(secureRandom(24));
}

export function buildPairingQrEnvelope(
  input: Omit<SecurePairingQrEnvelope, 'v' | 'kind'>,
): SecurePairingQrEnvelope {
  const envelope: SecurePairingQrEnvelope = {
    v: SECURE_PAIRING_VERSION,
    kind: 'sovereign-pairing',
    ...input,
  };
  const encoded = JSON.stringify(envelope);
  if (Buffer.byteLength(encoded, 'utf8') > 2048)
    throw new Error('Pairing QR envelope exceeds 2048 bytes');
  return envelope;
}

export function serializePairingQrEnvelope(envelope: SecurePairingQrEnvelope): string {
  const value = JSON.stringify(envelope);
  if (Buffer.byteLength(value, 'utf8') > 2048)
    throw new Error('Pairing QR envelope exceeds 2048 bytes');
  return value;
}

export function parsePairingInput(
  input: string,
  options: { allowManual?: boolean } = {},
): SecurePairingQrEnvelope {
  const text = input.trim();
  if (!text || Buffer.byteLength(text, 'utf8') > MAX_PAIRING_INPUT_BYTES)
    throw new Error('Pairing input is empty or oversized');
  let payload = text;
  if (text.startsWith('sovereign://pair?')) {
    const encoded = new URL(text).searchParams.get('data');
    if (!encoded) throw new Error('Pairing deep link is missing data');
    payload = Buffer.from(encoded, 'base64url').toString('utf8');
  } else if (!options.allowManual && !text.startsWith('{')) {
    throw new Error('Manual pairing input is disabled');
  }
  if (Buffer.byteLength(payload, 'utf8') > 2048)
    throw new Error('Pairing QR envelope exceeds 2048 bytes');
  let value: unknown;
  try {
    value = JSON.parse(payload);
  } catch {
    throw new Error('Malformed pairing QR envelope');
  }
  if (!value || typeof value !== 'object') throw new Error('Malformed pairing QR envelope');
  const record = value as Record<string, unknown>;
  const required = [
    'v',
    'kind',
    'protocol',
    'alpn',
    'hubId',
    'nodeId',
    'desktopPublicKey',
    'sessionRef',
    'expiresAt',
  ];
  if (
    required.some((key) => typeof record[key] !== 'string' && key !== 'v') ||
    record.v !== SECURE_PAIRING_VERSION ||
    record.kind !== 'sovereign-pairing' ||
    record.protocol !== 'sovereign-apps/1'
  )
    throw new Error('Unsupported or downgraded pairing envelope');
  if (typeof record.alpn !== 'string' || record.alpn.length < 1 || record.alpn.length > 128)
    throw new Error('Invalid pairing ALPN');
  if (typeof record.expiresAt !== 'string' || Date.parse(record.expiresAt) <= Date.now())
    throw new Error('Pairing QR envelope expired');
  if (typeof record.sessionRef !== 'string' || !/^[A-Za-z0-9_-]{32}$/.test(record.sessionRef))
    throw new Error('Invalid pairing session reference');
  for (const key of ['hubId', 'nodeId', 'desktopPublicKey'])
    if (typeof record[key] !== 'string' || !record[key] || record[key].length > 512)
      throw new Error(`Invalid pairing ${key}`);
  if (
    record.bootstrap !== undefined &&
    (typeof record.bootstrap !== 'string' || record.bootstrap.length > 512)
  )
    throw new Error('Invalid pairing bootstrap');
  return record as unknown as SecurePairingQrEnvelope;
}

export function buildPairingTranscript(input: Omit<PairingTranscript, 'domain'>): Uint8Array {
  const transcript: PairingTranscript = { domain: PAIRING_TRANSCRIPT_DOMAIN, ...input };
  return new TextEncoder().encode(canonicalJson(transcript));
}

export async function transcriptDigest(input: Omit<PairingTranscript, 'domain'>): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('WebCrypto digest unavailable');
  const digest = await subtle.digest('SHA-256', buildPairingTranscript(input) as BufferSource);
  return b64url(new Uint8Array(digest));
}

export type SignatureVerifier = (
  signature: Uint8Array,
  message: Uint8Array,
  publicKey: Uint8Array,
) => boolean;
export function verifyTranscript(
  signature: string,
  transcript: Omit<PairingTranscript, 'domain'>,
  publicKey: string,
  verify: SignatureVerifier,
): boolean {
  try {
    return verify(decode(signature), buildPairingTranscript(transcript), decode(publicKey));
  } catch {
    return false;
  }
}

export class PairingSessionStore {
  private readonly sessions = new Map<string, PairingSession>();
  constructor(
    private readonly maxAttempts = 5,
    private readonly maxConcurrent = 20,
  ) {}
  create(ttlMs = 120_000): PairingSession {
    if (this.sessions.size >= this.maxConcurrent)
      throw new Error('Pairing concurrency limit reached');
    if (!Number.isFinite(ttlMs) || ttlMs < 5_000 || ttlMs > 300_000)
      throw new Error('Invalid pairing TTL');
    const now = Date.now();
    const session = {
      sessionRef: createSessionRef(),
      expiresAt: now + ttlMs,
      consumed: false,
      attempts: 0,
      createdAt: now,
    };
    this.sessions.set(session.sessionRef, session);
    return { ...session };
  }
  consume(ref: string): PairingSession {
    const session = this.sessions.get(ref);
    if (!session || session.consumed || session.expiresAt <= Date.now())
      throw new Error('Pairing session is expired or already used');
    if (++session.attempts > this.maxAttempts) throw new Error('Pairing rate limit exceeded');
    session.consumed = true;
    return { ...session };
  }
  revoke(ref: string): void {
    this.sessions.delete(ref);
  }
  clear(): void {
    this.sessions.clear();
  }
}

export function intersectCapabilities(
  requested: PairingCapabilities,
  allowed: PairingCapabilities,
): PeerCapability[] {
  const allowedSet = new Set(allowed);
  return [...new Set(requested)].filter((cap) => allowedSet.has(cap));
}

export class PairingGrantStore {
  private readonly grants = new Map<string, PairingGrant>();
  issue(input: {
    peerKey: string;
    nodeId: string;
    capabilities: PairingCapabilities;
    now?: number;
    accessTtlMs?: number;
    refreshTtlMs?: number;
  }): PairingGrant {
    const now = input.now ?? Date.now();
    const accessTtlMs = input.accessTtlMs ?? ACCESS_GRANT_TTL_MS;
    const refreshTtlMs = input.refreshTtlMs ?? REFRESH_GRANT_TTL_MS;
    if (accessTtlMs <= 0 || refreshTtlMs <= accessTtlMs) throw new Error('Invalid grant lifetime');
    const grant: PairingGrant = {
      id: b64url(secureRandom(16)),
      peerKey: input.peerKey,
      nodeId: input.nodeId,
      accessToken: b64url(secureRandom(32)),
      refreshToken: b64url(secureRandom(32)),
      capabilities: [...new Set(input.capabilities)],
      issuedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + accessTtlMs).toISOString(),
      refreshExpiresAt: new Date(now + refreshTtlMs).toISOString(),
      rotation: 0,
    };
    this.grants.set(grant.id, grant);
    return { ...grant, capabilities: [...grant.capabilities] };
  }
  rotate(id: string, refreshToken: string, now = Date.now()): PairingGrant {
    const current = this.grants.get(id);
    if (
      !current ||
      current.revokedAt ||
      current.refreshToken !== refreshToken ||
      Date.parse(current.refreshExpiresAt) <= now
    )
      throw new Error('Invalid or reused refresh grant');
    current.refreshToken = b64url(secureRandom(32));
    current.accessToken = b64url(secureRandom(32));
    current.issuedAt = new Date(now).toISOString();
    current.expiresAt = new Date(now + ACCESS_GRANT_TTL_MS).toISOString();
    current.rotation += 1;
    return { ...current, capabilities: [...current.capabilities] };
  }
  revoke(id: string): void {
    const grant = this.grants.get(id);
    if (grant) grant.revokedAt = new Date().toISOString();
  }
  revokeAll(): void {
    for (const grant of this.grants.values()) grant.revokedAt = new Date().toISOString();
  }
  isAuthorized(id: string, accessToken: string, now = Date.now()): boolean {
    const grant = this.grants.get(id);
    return Boolean(
      grant &&
      !grant.revokedAt &&
      grant.accessToken === accessToken &&
      Date.parse(grant.expiresAt) > now,
    );
  }
  list(): PairingGrant[] {
    return [...this.grants.values()].map((grant) => ({
      ...grant,
      accessToken: '[redacted]',
      refreshToken: '[redacted]',
      capabilities: [...grant.capabilities],
    }));
  }
  clear(): void {
    this.grants.clear();
  }
}
