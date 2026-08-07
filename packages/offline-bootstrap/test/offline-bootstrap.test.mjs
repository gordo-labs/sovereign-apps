import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  BootstrapReplayStore,
  createBootstrapArtifact,
  createDeepLink,
  decodeNdefBootstrap,
  encodeNdefBootstrap,
  exportBootstrapFile,
  importBootstrapFile,
  parseDeepLink,
  confirmAndAccept,
  readBootstrapFile,
  redactBootstrapText,
} from '../dist/index.js';
import { buildPairingQrEnvelope } from '../../protocol/dist/index.js';

const envelope = (expiresAt = new Date(Date.now() + 60_000).toISOString()) =>
  buildPairingQrEnvelope({
    protocol: 'sovereign-apps/1',
    alpn: 'sovereign-apps/1',
    hubId: 'desktop',
    nodeId: 'node',
    desktopPublicKey: 'A'.repeat(43),
    sessionRef: 'A'.repeat(32),
    expiresAt,
  });

test('all adapters carry the same SA-005 artifact and require confirmation', async () => {
  const source = envelope();
  const file = exportBootstrapFile(source);
  const link = createDeepLink(source);
  assert.deepEqual(
    parseDeepLink(link).envelope,
    importBootstrapFile(file.bytes, file).envelope,
    'deep link and file decode identically',
  );
  assert.deepEqual(
    decodeNdefBootstrap(encodeNdefBootstrap(source)).envelope,
    file.bytes && importBootstrapFile(file.bytes, file).envelope,
  );
  const store = new BootstrapReplayStore();
  assert.deepEqual(await confirmAndAccept(parseDeepLink(link), () => false, store), {
    status: 'cancelled',
  });
  assert.equal(
    store.has(source.sessionRef),
    false,
    'cancellation does not consume one-time artifact',
  );
  assert.equal((await confirmAndAccept(parseDeepLink(link), () => true, store)).status, 'accepted');
  await assert.rejects(() => confirmAndAccept(parseDeepLink(link), () => true, store), /replayed/);
});

test('rejects expiry, malformed/oversized payloads, hostile URL encoding and traversal', async () => {
  assert.throws(() => parseDeepLink('sovereign://pair/pair?data=%ZZ'), /Malformed|data|URI/);
  assert.throws(() => parseDeepLink('https://evil.example/pair?data=AAAA'), /scheme|host/);
  assert.throws(
    () =>
      importBootstrapFile(new Uint8Array(2049), {
        filename: 'pairing.sovereign-pairing',
        mime: 'application/vnd.sovereign-apps.pairing+json',
      }),
    /oversized/,
  );
  assert.throws(() => exportBootstrapFile(envelope(), '../pairing.sovereign-pairing'), /filename/);
  assert.throws(
    () =>
      importBootstrapFile(new TextEncoder().encode('{}'), {
        filename: 'pairing.sovereign-pairing',
        mime: 'text/plain',
      }),
    /MIME/,
  );
  assert.throws(
    () => createBootstrapArtifact(envelope(new Date(Date.now() - 1).toISOString())),
    /expired/,
  );
  const dir = await mkdtemp(join(tmpdir(), 'sovereign-offline-'));
  await writeFile(join(dir, 'pairing.sovereign-pairing'), exportBootstrapFile(envelope()).bytes);
  await assert.rejects(
    () => readBootstrapFile(join(dir, 'pairing.sovereign-pairing'), { mime: 'text/plain' }),
    /MIME/,
  );
  await assert.rejects(
    () =>
      readBootstrapFile(join(dir, 'pairing.sovereign-pairing'), {
        filename: '../pairing.sovereign-pairing',
        mime: 'application/vnd.sovereign-apps.pairing+json',
      }),
    /traversal|filename/,
  );
});

test('safe preview never includes bootstrap material', () => {
  assert.equal(redactBootstrapText().includes('A'.repeat(10)), false);
});
