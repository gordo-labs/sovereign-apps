/**
 * Node key management for Iroh endpoints.
 * Persists a 32-byte Ed25519 key so the node identity survives restarts.
 */

import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { env } from 'node:process';

export function createNodeKey(): Uint8Array {
  const keyPath = nodeKeyPath();
  if (existsSync(keyPath)) {
    const bytes = readFileSync(keyPath);
    if (bytes.byteLength !== 32) {
      throw new Error('Invalid persisted sovereign node key');
    }
    return new Uint8Array(bytes);
  }
  const bytes = randomBytes(32);
  writeFileSync(keyPath, bytes, { mode: 0o600 });
  return new Uint8Array(bytes);
}

function nodeKeyPath(): string {
  const dataDir = env.SOVEREIGN_DATA_DIR ?? join(env.HOME ?? '/tmp', '.sovereign-apps');
  const dir = join(dataDir, 'keys');
  if (!existsSync(dir)) {
    writeFileSync(dir, '', { mode: 0o700 }); // create dir by writing empty then removing
  }
  return join(dir, 'node-key.bin');
}
