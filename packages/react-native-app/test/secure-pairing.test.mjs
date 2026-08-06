import test from 'node:test';
import assert from 'node:assert/strict';
import { MobilePairingClient } from '../dist/hub-pairing.js';
import { buildPairingQrEnvelope } from '../../protocol/dist/index.js';

test('mobile secure proof is bound to the scanned QR and user confirmation', () => {
  const envelope = buildPairingQrEnvelope({
    protocol: 'sovereign-apps/1',
    alpn: 'sovereign-apps/1',
    hubId: 'desktop-app',
    nodeId: 'desktop-node',
    desktopPublicKey: 'desktop-key',
    sessionRef: 'A'.repeat(32),
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  });
  const client = new MobilePairingClient();
  const scanned = client.handleQrScan(JSON.stringify(envelope));
  assert.equal('error' in scanned, false);
  client.verifyFingerprint();
  const proof = client.buildSecureProof({
    mobilePublicKey: 'mobile-key',
    mobileNodeId: 'mobile-node',
    requested: ['app.read'],
    granted: ['app.read'],
    nonce: 'nonce-1',
    sign: () => 'signature',
  });
  assert.equal(proof.sessionRef, envelope.sessionRef);
  assert.equal(proof.transcript.desktopPublicKey, envelope.desktopPublicKey);
  assert.equal(proof.transcript.mobileNodeId, 'mobile-node');
});

test('mobile rejects a grant for another identity', () => {
  const client = new MobilePairingClient();
  const proof = {
    sessionRef: 'A'.repeat(32),
    transcript: {
      protocol: 'sovereign-apps/1',
      alpn: 'sovereign-apps/1',
      sessionRef: 'A'.repeat(32),
      desktopPublicKey: 'desktop-key',
      desktopNodeId: 'desktop-node',
      mobilePublicKey: 'mobile-key',
      mobileNodeId: 'mobile-node',
      nonce: 'nonce-1',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      requested: ['app.read'],
      granted: ['app.read'],
    },
    signature: 'signature',
  };
  assert.throws(
    () =>
      client.handleSecureGrant(
        {
          id: 'grant',
          peerKey: 'attacker-key',
          nodeId: 'mobile-node',
          accessToken: 'access',
          refreshToken: 'refresh',
          capabilities: ['app.read'],
          issuedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
          refreshExpiresAt: new Date(Date.now() + 120_000).toISOString(),
          rotation: 0,
        },
        proof,
      ),
    /peer identity mismatch/,
  );
});
