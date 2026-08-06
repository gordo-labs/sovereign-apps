type DiscoveryCandidate = { readonly id: string; readonly transport: string; readonly address: string; readonly metadata?: Readonly<Record<string, string>>; readonly seenAt: string };
type TransportCandidate = { readonly id: string; readonly kind: string; readonly address: string; readonly priority?: number };

/** Versioned DNS-SD service used for same-LAN discovery. This is not Wi-Fi Direct. */
export const LAN_SERVICE_TYPE = '_sovereign-apps._tcp';
export const LAN_SERVICE_DOMAIN = 'local.';
export const LAN_RECORD_VERSION = '1';
export const LAN_RECORD_TTL_MS = 30_000;
export const LAN_MAX_TXT_BYTES = 1_024;

export type LanDiscoveryRecord = {
  version: 1;
  appId: string;
  nodeId: string;
  /** Direct Iroh socket hints only; these are untrusted until pairing. */
  directAddrs: string[];
  /** Opaque, short-lived pairing reference. Never a bearer token. */
  sessionRef?: string;
  fingerprint?: string;
  displayName?: string;
  expiresAt?: string;
};

export type LanDiscoveryCandidate = DiscoveryCandidate & {
  transport: 'iroh.lan';
  metadata: Readonly<Record<string, string>>;
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder('utf-8', { fatal: true });

function bounded(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= max && !/[\u0000\r\n]/u.test(value);
}

function validSocket(value: string): boolean {
  const normalized = value.trim();
  return /^(?:\[[0-9a-f:]+\]|[a-z0-9.-]+):[1-9][0-9]{0,4}$/iu.test(normalized);
}

function safeJson(value: unknown): string {
  return JSON.stringify(value);
}

/** Convert the bounded record into TXT keys suitable for Bonjour/zeroconf. */
export function encodeLanTxt(record: LanDiscoveryRecord): Record<string, string> {
  const parsed = validateLanRecord(record);
  const txt: Record<string, string> = {
    v: LAN_RECORD_VERSION,
    app: parsed.appId,
    node: parsed.nodeId,
    addrs: safeJson(parsed.directAddrs),
  };
  if (parsed.sessionRef) txt.session = parsed.sessionRef;
  if (parsed.fingerprint) txt.fp = parsed.fingerprint;
  if (parsed.displayName) txt.name = parsed.displayName;
  if (parsed.expiresAt) txt.exp = parsed.expiresAt;
  const total = Object.entries(txt).reduce((sum, [key, value]) => sum + key.length + value.length + 2, 0);
  if (total > LAN_MAX_TXT_BYTES) throw new Error('LAN discovery TXT record exceeds size limit');
  return txt;
}

/** Parse untrusted DNS-SD TXT records; unknown keys are ignored. */
export function parseLanTxt(raw: Readonly<Record<string, unknown>>): LanDiscoveryRecord | null {
  try {
    if (String(raw.v ?? '') !== LAN_RECORD_VERSION) return null;
    const appId = String(raw.app ?? '');
    const nodeId = String(raw.node ?? '');
    if (!bounded(appId, 128) || !bounded(nodeId, 128)) return null;
    let directAddrs: unknown;
    try { directAddrs = JSON.parse(String(raw.addrs ?? '')); } catch { return null; }
    if (!Array.isArray(directAddrs) || directAddrs.length > 8 || directAddrs.some((value) => typeof value !== 'string' || !validSocket(value))) return null;
    const result: LanDiscoveryRecord = {
      version: 1,
      appId,
      nodeId,
      directAddrs: [...new Set(directAddrs.map((value) => value.trim()))],
    };
    const optional: Array<[keyof LanDiscoveryRecord, number, string]> = [
      ['sessionRef', 192, 'session'],
      ['fingerprint', 128, 'fp'],
      ['displayName', 96, 'name'],
      ['expiresAt', 40, 'exp'],
    ];
    for (const [field, max, key] of optional) {
      const value = raw[key];
      if (value !== undefined) {
        const text = String(value);
        if (!bounded(text, max)) return null;
        Object.assign(result, { [field]: text });
      }
    }
    return validateLanRecord(result);
  } catch { return null; }
}

export function validateLanRecord(record: LanDiscoveryRecord): LanDiscoveryRecord {
  if (record.version !== 1 || !bounded(record.appId, 128) || !bounded(record.nodeId, 128)) throw new Error('Invalid LAN discovery identity');
  if (!Array.isArray(record.directAddrs) || record.directAddrs.length > 8 || record.directAddrs.some((value) => !validSocket(value))) throw new Error('Invalid LAN discovery address');
  for (const value of [record.sessionRef, record.fingerprint, record.displayName, record.expiresAt]) {
    if (value !== undefined && !bounded(value, 192)) throw new Error('Invalid LAN discovery optional field');
  }
  return { ...record, directAddrs: [...new Set(record.directAddrs.map((value) => value.trim()))] };
}

export function lanRecordToCandidate(record: LanDiscoveryRecord, seenAt = new Date().toISOString()): LanDiscoveryCandidate {
  const valid = validateLanRecord(record);
  return {
    id: valid.nodeId,
    transport: 'iroh.lan',
    address: JSON.stringify({ id: valid.nodeId, addrs: valid.directAddrs }),
    seenAt,
    metadata: {
      appId: valid.appId,
      ...(valid.sessionRef ? { sessionRef: valid.sessionRef } : {}),
      ...(valid.fingerprint ? { fingerprint: valid.fingerprint } : {}),
      ...(valid.displayName ? { displayName: valid.displayName } : {}),
    },
  };
}

export function discoveryCandidateToTransport(candidate: LanDiscoveryCandidate): TransportCandidate {
  return { id: candidate.id, kind: 'iroh.lan', address: candidate.address, priority: 10 };
}

/** Stable peer key prevents duplicate names/interfaces from creating duplicate rows. */
export function lanPeerKey(record: LanDiscoveryRecord): string { return `${record.appId}:${record.nodeId}`; }
