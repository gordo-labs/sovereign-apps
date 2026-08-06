import { z } from 'zod';
import {
  MAX_CORRELATION_ID_BYTES,
  MAX_ID_BYTES,
  MAX_MESSAGE_TYPE_BYTES,
  WIRE_VERSION,
  type WireEnvelope,
} from './types.js';
import { PAIRING_KIND, PAIRING_VERSION, AUTH_VERSION, PeerCapabilities } from './pairing.js';

const id = z.string().min(1).max(MAX_ID_BYTES);
const correlationId = z.string().min(1).max(MAX_CORRELATION_ID_BYTES);
const base64url = z.string().regex(/^[A-Za-z0-9_-]+$/, 'must be base64url');

export const WireEnvelopeSchema = z
  .object({
    version: z.literal(WIRE_VERSION),
    type: z.enum(['request', 'response', 'event', 'error', 'close']),
    correlationId,
    payload: z.unknown(),
  })
  .strict();

export const WireErrorSchema = z
  .object({
    code: z.string().min(1).max(64),
    message: z.string().min(1).max(1024),
    retryable: z.boolean().optional(),
  })
  .strict();

export const WireCloseSchema = z
  .object({
    code: z.string().min(1).max(64),
    reason: z.string().max(1024).optional(),
  })
  .strict();

export const PairingQrPayloadSchema = z
  .object({
    v: z.literal(PAIRING_VERSION),
    kind: z.literal(PAIRING_KIND),
    hubId: id,
    nodeId: id,
    publicKey: base64url.nullable(),
    bootstrap: z.string().url().max(512).nullable(),
    directAddrs: z.array(z.string().min(1).max(512)).max(16).optional(),
  })
  .strict();

export const PeerCapabilitySchema = z.enum(
  Object.values(PeerCapabilities) as [string, ...string[]],
);

export const AuthChallengeSchema = z
  .object({
    type: z.literal('auth.challenge'),
    version: z.literal(AUTH_VERSION),
    nonce: base64url.min(16).max(64),
    challenger: id,
    requested: z.array(PeerCapabilitySchema).max(32),
  })
  .strict();

export const AuthResponseSchema = z
  .object({
    type: z.literal('auth.response'),
    version: z.literal(AUTH_VERSION),
    nonce: base64url.min(16).max(64),
    signature: base64url.min(32).max(128),
    publicKey: base64url.min(32).max(64),
    granted: z.array(PeerCapabilitySchema).max(32),
  })
  .strict();

export const AuthGrantSchema = z
  .object({
    type: z.literal('auth.grant'),
    version: z.literal(AUTH_VERSION),
    grantor: id,
    grantee: id,
    capabilities: z.array(PeerCapabilitySchema).max(32),
    expiresAt: z.string().datetime().nullable(),
  })
  .strict();

export const ConnectionCandidateSchema = z
  .object({
    kind: z.enum(['direct', 'relay', 'mdns', 'bluetooth']),
    address: z.string().min(1).max(512),
  })
  .strict();

export const PresenceRecordSchema = z
  .object({
    schemaVersion: z.literal(WIRE_VERSION),
    hubId: id,
    transportPeerId: id,
    transportKind: z.enum(['iroh', 'webrtc', 'bluetooth']).optional(),
    relayUrl: z.string().url().max(512).optional(),
    issuedAt: z.string().datetime(),
    expiresAt: z.string().datetime(),
    candidates: z.array(ConnectionCandidateSchema).max(16).optional(),
    signature: base64url.min(16).max(512),
  })
  .strict();

export const SignalingEnvelopeSchema = z
  .object({
    schemaVersion: z.literal(WIRE_VERSION),
    hubId: id,
    sessionId: id,
    kind: z.enum(['session_offer', 'session_answer', 'ice_candidate', 'keepalive']),
    issuedAt: z.string().datetime(),
    expiresAt: z.string().datetime(),
    body: z.record(z.string(), z.unknown()),
    signature: base64url.min(16).max(512),
  })
  .strict();

/** Keys that can leak app-specific secrets or domain metadata into neutral records. */
export const FORBIDDEN_RECORD_KEYS = new Set([
  'filePath',
  'file_path',
  'library',
  'libraryPath',
  'playlist',
  'playlistName',
  'track',
  'trackId',
  'token',
  'pairingCode',
  'pairing_code',
  'pairingSecret',
  'mediaToken',
  'accessToken',
  'refreshToken',
  'license',
  'cloudflare',
  'tailscale',
  'secret',
  'path',
  'shareLink',
  'capabilities',
]);

export function findForbiddenRecordKeys(value: unknown, path = ''): string[] {
  if (value === null || typeof value !== 'object') return [];
  if (Array.isArray(value))
    return value.flatMap((entry, i) => findForbiddenRecordKeys(entry, `${path}[${i}]`));
  const result: string[] = [];
  for (const [key, nested] of Object.entries(value)) {
    const next = path ? `${path}.${key}` : key;
    if (FORBIDDEN_RECORD_KEYS.has(key.trim())) result.push(next);
    result.push(...findForbiddenRecordKeys(nested, next));
  }
  return result;
}

export function parseWireEnvelope(value: unknown): WireEnvelope {
  const result = WireEnvelopeSchema.safeParse(value);
  if (!result.success) throw new Error(`Invalid wire envelope: ${result.error.message}`);
  const forbidden = findForbiddenRecordKeys(result.data.payload);
  if (forbidden.length > 0) throw new Error(`Forbidden payload fields: ${forbidden.join(', ')}`);
  return result.data as WireEnvelope;
}

export function parsePairingQrPayload(value: unknown) {
  const result = PairingQrPayloadSchema.safeParse(value);
  if (!result.success) throw new Error(`Invalid pairing QR payload: ${result.error.message}`);
  return result.data;
}

export function parsePresenceRecord(value: unknown) {
  const result = PresenceRecordSchema.safeParse(value);
  if (!result.success) throw new Error(`Invalid presence record: ${result.error.message}`);
  const forbidden = findForbiddenRecordKeys(result.data);
  if (forbidden.length > 0) throw new Error(`Forbidden presence fields: ${forbidden.join(', ')}`);
  return result.data;
}

export type PresenceVerifyFailure =
  | 'malformed'
  | 'forbidden_metadata'
  | 'expired'
  | 'ttl_too_long'
  | 'future'
  | 'replay'
  | 'bad_signature';
export type PresenceVerifyResult =
  | { ok: true; record: z.infer<typeof PresenceRecordSchema> }
  | { ok: false; code: PresenceVerifyFailure; message: string };
export type PresenceSignatureVerifier = (
  canonicalPayload: Uint8Array,
  signature: string,
  trustedPublicKey: string,
) => boolean | Promise<boolean>;

/** Deterministic JSON used by platform-specific Ed25519 implementations. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  return `{${Object.keys(value as Record<string, unknown>)
    .sort()
    .map(
      (key) => `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`,
    )
    .join(',')}}`;
}

export async function verifyPresenceRecord(
  value: unknown,
  trustedPublicKey: string,
  verifySignature: PresenceSignatureVerifier,
  options: {
    now?: number;
    maxClockSkewMs?: number;
    maxTtlMs?: number;
    lastAcceptedIssuedAt?: string;
  } = {},
): Promise<PresenceVerifyResult> {
  let record: ReturnType<typeof parsePresenceRecord>;
  try {
    record = parsePresenceRecord(value);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      code: message.includes('Forbidden') ? 'forbidden_metadata' : 'malformed',
      message,
    };
  }
  const now = options.now ?? Date.now();
  const skew = options.maxClockSkewMs ?? 30_000;
  const maxTtl = options.maxTtlMs ?? 120_000;
  const issued = Date.parse(record.issuedAt);
  const expires = Date.parse(record.expiresAt);
  if (now >= expires) return { ok: false, code: 'expired', message: 'Presence record has expired' };
  if (expires - issued > maxTtl + skew)
    return { ok: false, code: 'ttl_too_long', message: 'Presence TTL exceeds maximum' };
  if (issued > now + skew)
    return { ok: false, code: 'future', message: 'issuedAt exceeds allowed clock skew' };
  if (options.lastAcceptedIssuedAt && issued <= Date.parse(options.lastAcceptedIssuedAt))
    return {
      ok: false,
      code: 'replay',
      message: 'Presence record is not newer than last accepted',
    };
  const { signature: _signature, ...unsigned } = record;
  let valid = false;
  try {
    valid = await verifySignature(
      new TextEncoder().encode(canonicalJson(unsigned)),
      record.signature,
      trustedPublicKey,
    );
  } catch {
    valid = false;
  }
  return valid
    ? { ok: true, record }
    : { ok: false, code: 'bad_signature', message: 'Presence signature verification failed' };
}

export function parseAuthObject(value: unknown) {
  for (const schema of [AuthChallengeSchema, AuthResponseSchema, AuthGrantSchema]) {
    const result = schema.safeParse(value);
    if (result.success) return result.data;
  }
  throw new Error('Invalid authentication object');
}
