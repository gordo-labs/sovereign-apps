import { createPublicKey, verify as verifySignature } from 'node:crypto';
import { canonicalJson, parsePresenceRecord } from '@sovereign-apps/protocol';
import {
  MemoryPresenceStore,
  MemoryRateLimiter,
  MemorySignalingStore,
  PresenceError,
  WebPresenceCore,
  type PresenceCodec,
} from '@sovereign-apps/web-presence';

type PresenceRecord = ReturnType<typeof parsePresenceRecord>;
type Runtime = WebPresenceCore<PresenceRecord, unknown>;

let configured: Runtime | undefined;

function decodeBase64Url(value: string): Buffer {
  return Buffer.from(
    value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4),
    'base64',
  );
}

function codec(): PresenceCodec<PresenceRecord> {
  const publicKey = process.env.PRESENCE_TRUSTED_PUBLIC_KEY;
  return {
    verify(value, { nowMs, expectedIdentity }) {
      const record = parsePresenceRecord(value);
      if (expectedIdentity && record.hubId !== expectedIdentity) {
        throw new PresenceError('identity_mismatch', 400);
      }
      if (!publicKey) throw new PresenceError('verification_not_configured', 503);
      const issuedAtMs = Date.parse(record.issuedAt);
      const expiresAtMs = Date.parse(record.expiresAt);
      const { signature, ...unsigned } = record;
      let valid = false;
      try {
        const rawKey = decodeBase64Url(publicKey);
        const key = createPublicKey({
          key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), rawKey]),
          format: 'der',
          type: 'spki',
        });
        valid = verifySignature(
          null,
          Buffer.from(canonicalJson(unsigned)),
          key,
          decodeBase64Url(signature),
        );
      } catch {
        valid = false;
      }
      if (!valid) throw new PresenceError('bad_signature', 400);
      return {
        identity: record.hubId,
        issuedAtMs,
        expiresAtMs,
        candidateCount: record.candidates?.length ?? 0,
      };
    },
  };
}

export function configureWebPresenceRuntime(runtime: Runtime): void {
  configured = runtime;
}

export function getWebPresenceRuntime(): Runtime {
  if (configured) return configured;
  configured = new WebPresenceCore({
    presence: new MemoryPresenceStore<PresenceRecord>(),
    signaling: new MemorySignalingStore(),
    rateLimiter: new MemoryRateLimiter(),
    codec: codec(),
  });
  return configured;
}

export function sanitizePresence(record: PresenceRecord) {
  return {
    hubId: record.hubId,
    transportPeerId: record.transportPeerId,
    transportKind: record.transportKind,
    issuedAt: record.issuedAt,
    expiresAt: record.expiresAt,
    candidateKinds: (record.candidates ?? []).map(({ kind }) => kind),
  };
}
