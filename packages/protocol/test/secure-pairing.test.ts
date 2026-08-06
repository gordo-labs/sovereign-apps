import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PairingGrantStore,
  PairingSessionStore,
  buildPairingQrEnvelope,
  parsePairingInput,
  intersectCapabilities,
  type PeerCapability,
} from '../dist/index.js';

const envelope = () => buildPairingQrEnvelope({
  protocol: 'sovereign-apps/1', alpn: 'sovereign-apps/1', hubId: 'desktop', nodeId: 'node',
  desktopPublicKey: 'A'.repeat(43), sessionRef: 'A'.repeat(32),
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
});

test('pairing input rejects tampering, downgrade, oversized and expired envelopes', () => {
  const value = envelope();
  assert.equal(parsePairingInput(JSON.stringify(value)).nodeId, 'node');
  assert.throws(() => parsePairingInput(JSON.stringify({ ...value, v: 1 })), /downgraded|Unsupported/);
  assert.throws(() => parsePairingInput(JSON.stringify({ ...value, sessionRef: 'x' })), /session reference/);
  assert.throws(() => parsePairingInput(JSON.stringify({ ...value, expiresAt: new Date(Date.now() - 1).toISOString() })), /expired/);
  assert.throws(() => parsePairingInput('x'.repeat(5000)), /oversized/);
});

test('pairing session is one-time and rate/concurrency bounded', () => {
  const store = new PairingSessionStore(1, 1);
  const session = store.create();
  assert.equal(store.consume(session.sessionRef).consumed, true);
  assert.throws(() => store.consume(session.sessionRef), /expired|already used/);
});

test('refresh rotation invalidates reuse and revocation denies access', () => {
  const store = new PairingGrantStore();
  const grant = store.issue({ peerKey: 'mobile', nodeId: 'node', capabilities: ['app.read' as PeerCapability] });
  assert.equal(store.isAuthorized(grant.id, grant.accessToken), true);
  const rotated = store.rotate(grant.id, grant.refreshToken);
  assert.notEqual(rotated.refreshToken, grant.refreshToken);
  assert.throws(() => store.rotate(grant.id, grant.refreshToken), /Invalid or reused/);
  store.revoke(grant.id);
  assert.equal(store.isAuthorized(grant.id, rotated.accessToken), false);
});

test('capabilities can only be intersected, never escalated', () => {
  assert.deepEqual(intersectCapabilities(['app.read', 'app.write'] as PeerCapability[], ['app.read'] as PeerCapability[]), ['app.read']);
});
