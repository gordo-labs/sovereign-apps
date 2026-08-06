import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CorruptIdentityError, loadOrCreateIdentities } from '../dist/node-key.js';

test('persists independent Iroh and app identities', () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'sovereign-electron-'));
  const first = loadOrCreateIdentities({ dataDir });
  const second = loadOrCreateIdentities({ dataDir });
  assert.equal(Buffer.from(first.iroh.bytes).toString('hex'), Buffer.from(second.iroh.bytes).toString('hex'));
  assert.equal(Buffer.from(first.app.bytes).toString('hex'), Buffer.from(second.app.bytes).toString('hex'));
  assert.notEqual(first.iroh.fingerprint, first.app.fingerprint);
});

test('does not silently replace a corrupted identity', () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'sovereign-electron-'));
  const first = loadOrCreateIdentities({ dataDir });
  writeFileSync(join(dataDir, 'keys', 'iroh-node-key.bin'), Buffer.alloc(3));
  assert.throws(() => loadOrCreateIdentities({ dataDir }), (error: unknown) => error instanceof CorruptIdentityError);
  assert.equal(first.app.bytes.byteLength, 32);
});
