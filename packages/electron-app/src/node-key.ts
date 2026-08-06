import { createHash, randomBytes } from 'node:crypto';
import { chmodSync, closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export type IdentityKind = 'iroh-node' | 'app-ed25519';

export type PersistedIdentity = {
  readonly kind: IdentityKind;
  readonly bytes: Uint8Array;
  readonly fingerprint: string;
};

export class CorruptIdentityError extends Error {
  constructor(readonly path: string, message = `Corrupt ${path}`) {
    super(message);
    this.name = 'CorruptIdentityError';
  }
}

export type IdentityStoreOptions = {
  dataDir?: string;
  env?: NodeJS.ProcessEnv;
};

/**
 * Loads two deliberately separate identities. A malformed existing file is a
 * hard error: replacing a key would silently change the peer identity.
 */
export function loadOrCreateIdentities(options: IdentityStoreOptions = {}): {
  iroh: PersistedIdentity;
  app: PersistedIdentity;
} {
  const dataDir = resolveDataDir(options);
  const keyDir = join(dataDir, 'keys');
  ensurePrivateDirectory(keyDir);
  return {
    iroh: loadOrCreateIdentity(join(keyDir, 'iroh-node-key.bin'), 'iroh-node'),
    app: loadOrCreateIdentity(join(keyDir, 'app-ed25519-key.bin'), 'app-ed25519'),
  };
}

export function createNodeKey(options: IdentityStoreOptions = {}): Uint8Array {
  return loadOrCreateIdentities(options).iroh.bytes;
}

export function identityPath(kind: IdentityKind, options: IdentityStoreOptions = {}): string {
  const dataDir = resolveDataDir(options);
  return join(dataDir, 'keys', kind === 'iroh-node' ? 'iroh-node-key.bin' : 'app-ed25519-key.bin');
}

export function loadOrCreateIdentity(path: string, kind: IdentityKind): PersistedIdentity {
  if (existsSync(path)) {
    tightenPrivateFile(path);
    const bytes = new Uint8Array(readFileSync(path));
    if (bytes.byteLength !== 32 || bytes.every((value) => value === 0)) {
      throw new CorruptIdentityError(path, `${kind} identity must be 32 non-zero bytes`);
    }
    return { kind, bytes, fingerprint: fingerprint(bytes) };
  }
  const bytes = randomBytes(32);
  atomicPrivateWrite(path, bytes);
  return { kind, bytes: new Uint8Array(bytes), fingerprint: fingerprint(bytes) };
}

function resolveDataDir(options: IdentityStoreOptions): string {
  const env = options.env ?? process.env;
  return options.dataDir ?? env.SOVEREIGN_DATA_DIR ?? join(process.cwd(), '.sovereign-apps');
}

function ensurePrivateDirectory(path: string): void {
  mkdirSync(path, { recursive: true, mode: 0o700 });
  chmodSync(path, 0o700);
}

function atomicPrivateWrite(path: string, bytes: Uint8Array): void {
  ensurePrivateDirectory(join(path, '..'));
  const temp = `${path}.tmp-${process.pid}-${randomBytes(6).toString('hex')}`;
  const fd = openSync(temp, 'wx', 0o600);
  try {
    writeFileSync(fd, bytes);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  chmodSync(temp, 0o600);
  renameSync(temp, path);
  tightenPrivateFile(path);
}

function tightenPrivateFile(path: string): void {
  try { chmodSync(path, 0o600); } catch { /* read-only test files may reject chmod */ }
}

function fingerprint(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex').slice(0, 32).replace(/(.{4})/g, '$1:').replace(/:$/, '');
}

export function removeIdentityForTest(path: string): void {
  if (existsSync(path)) unlinkSync(path);
}
