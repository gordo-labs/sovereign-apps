import { basename, extname } from 'node:path';
import { open } from 'node:fs/promises';
import { createBootstrapArtifact, encodeBootstrapArtifact, validateBootstrapArtifact, confirmAndAccept, BootstrapReplayStore, type BootstrapArtifact, type HandoffResult } from './artifact.js';
import type { SecurePairingQrEnvelope } from '@sovereign-apps/protocol';

export type BootstrapFile = Readonly<{ filename: string; mime: typeof import('./artifact.js').PAIRING_FILE_MIME; bytes: Uint8Array }>;
export function exportBootstrapFile(envelope: SecurePairingQrEnvelope, filename = `pairing${'.sovereign-pairing'}`): BootstrapFile {
  const safe = basename(filename);
  if (safe !== filename || extname(safe) !== '.sovereign-pairing') throw new Error('Invalid pairing filename');
  return { filename: safe, mime: 'application/vnd.sovereign-apps.pairing+json', bytes: encodeBootstrapArtifact(createBootstrapArtifact(envelope)) };
}

export function importBootstrapFile(bytes: Uint8Array, metadata: { filename: string; mime: string }, options: { now?: number } = {}): BootstrapArtifact {
  if (basename(metadata.filename) !== metadata.filename || !metadata.filename.endsWith('.sovereign-pairing')) throw new Error('Invalid pairing filename');
  if (metadata.mime !== 'application/vnd.sovereign-apps.pairing+json') throw new Error('Pairing file MIME mismatch');
  return validateBootstrapArtifact(bytes, options);
}

export async function readBootstrapFile(path: string, metadata: { filename?: string; mime: string }, options: { now?: number; maxBytes?: number } = {}): Promise<BootstrapArtifact> {
  const filename = metadata.filename ?? basename(path);
  if (basename(filename) !== filename || !filename.endsWith('.sovereign-pairing')) throw new Error('Path traversal or invalid pairing filename');
  const handle = await open(path, 'r');
  try {
    const stat = await handle.stat();
    const maxBytes = options.maxBytes ?? 2048;
    if (!stat.isFile() || stat.size > maxBytes) throw new Error('Pairing file is oversized or not a regular file');
    const bytes = await handle.readFile();
    return importBootstrapFile(bytes, { filename, mime: metadata.mime }, options);
  } finally { await handle.close(); }
}

export async function handoffBootstrapFile(path: string, metadata: { filename?: string; mime: string }, confirm: (artifact: BootstrapArtifact) => Promise<boolean> | boolean, replayStore: BootstrapReplayStore, options: { now?: number; maxBytes?: number } = {}): Promise<HandoffResult> {
  return confirmAndAccept(await readBootstrapFile(path, metadata, options), confirm, replayStore);
}
