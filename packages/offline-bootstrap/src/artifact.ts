import { parsePairingInput, serializePairingQrEnvelope, type SecurePairingQrEnvelope } from '@sovereign-apps/protocol';

export const OFFLINE_ARTIFACT_VERSION = 1 as const;
export const MAX_OFFLINE_ARTIFACT_BYTES = 2048;
export const PAIRING_FILE_EXTENSION = '.sovereign-pairing';
export const PAIRING_FILE_MIME = 'application/vnd.sovereign-apps.pairing+json';

export type BootstrapArtifact = Readonly<{
  version: typeof OFFLINE_ARTIFACT_VERSION;
  kind: 'sovereign-pairing-bootstrap';
  envelope: SecurePairingQrEnvelope;
}>;

export type ArtifactValidationOptions = { now?: number; maxBytes?: number };

const bytesOf = (value: string): Uint8Array => new TextEncoder().encode(value);

/** The artifact is the SA-005 envelope verbatim; adapters never add an auth flow. */
export function createBootstrapArtifact(envelope: SecurePairingQrEnvelope): BootstrapArtifact {
  // Serialize through the protocol parser first so callers cannot smuggle a parallel shape.
  const parsed = parsePairingInput(serializePairingQrEnvelope(envelope), { allowManual: true });
  return Object.freeze({ version: OFFLINE_ARTIFACT_VERSION, kind: 'sovereign-pairing-bootstrap', envelope: parsed });
}

export function encodeBootstrapArtifact(artifact: BootstrapArtifact): Uint8Array {
  const canonical = serializePairingQrEnvelope(artifact.envelope);
  const bytes = bytesOf(canonical);
  if (bytes.byteLength > MAX_OFFLINE_ARTIFACT_BYTES) throw new Error('Bootstrap artifact exceeds size limit');
  return bytes;
}

export function validateBootstrapArtifact(data: Uint8Array | string, options: ArtifactValidationOptions = {}): BootstrapArtifact {
  const bytes = typeof data === 'string' ? bytesOf(data) : new Uint8Array(data);
  const maxBytes = options.maxBytes ?? MAX_OFFLINE_ARTIFACT_BYTES;
  if (bytes.byteLength === 0 || bytes.byteLength > maxBytes) throw new Error('Bootstrap artifact is empty or oversized');
  let text: string;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { throw new Error('Bootstrap artifact is not valid UTF-8'); }
  const envelope = parsePairingInput(text, { allowManual: true });
  if (Date.parse(envelope.expiresAt) <= (options.now ?? Date.now())) throw new Error('Bootstrap artifact expired');
  return Object.freeze({ version: OFFLINE_ARTIFACT_VERSION, kind: 'sovereign-pairing-bootstrap', envelope });
}

export class BootstrapReplayStore {
  private readonly consumed = new Map<string, number>();
  constructor(private readonly maxEntries = 1024) {}
  consume(artifact: BootstrapArtifact, now = Date.now()): void {
    for (const [key, expiry] of this.consumed) if (expiry <= now) this.consumed.delete(key);
    const ref = artifact.envelope.sessionRef;
    if (this.consumed.has(ref)) throw new Error('Bootstrap artifact already replayed');
    if (Date.parse(artifact.envelope.expiresAt) <= now) throw new Error('Bootstrap artifact expired');
    if (this.consumed.size >= this.maxEntries) throw new Error('Bootstrap replay store is full');
    this.consumed.set(ref, Date.parse(artifact.envelope.expiresAt));
  }
  has(sessionRef: string): boolean { return this.consumed.has(sessionRef); }
  clear(): void { this.consumed.clear(); }
}

export type HandoffResult = { readonly status: 'accepted' | 'cancelled'; readonly artifact?: BootstrapArtifact };
export async function confirmAndAccept(
  artifact: BootstrapArtifact,
  confirm: (artifact: BootstrapArtifact) => Promise<boolean> | boolean,
  replayStore: BootstrapReplayStore,
): Promise<HandoffResult> {
  if (!(await confirm(artifact))) return { status: 'cancelled' };
  replayStore.consume(artifact);
  return { status: 'accepted', artifact };
}

/** Safe for diagnostics/clipboard previews. Never log or copy the artifact bytes. */
export function redactBootstrapText(): string { return '[sovereign pairing artifact redacted]'; }
