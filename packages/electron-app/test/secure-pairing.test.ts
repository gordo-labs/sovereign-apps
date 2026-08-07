import test from 'node:test';
import assert from 'node:assert/strict';
import { DesktopPairingAuthority } from '../dist/secure-pairing.js';
import {
  buildPairingTranscript,
  type SecurePairingProof,
  type SecurePairingQrEnvelope,
} from '@sovereign-apps/protocol';

function proof(qr: SecurePairingQrEnvelope): SecurePairingProof {
  const sessionRef = qr.sessionRef;
  const transcript = {
    protocol: qr.protocol,
    alpn: qr.alpn,
    sessionRef: qr.sessionRef,
    desktopPublicKey: qr.desktopPublicKey,
    desktopNodeId: qr.nodeId,
    mobilePublicKey: 'mobile-key',
    mobileNodeId: 'mobile-node',
    nonce: 'nonce-1',
    expiresAt: qr.expiresAt,
    requested: ['app.read'] as const,
    granted: ['app.read'] as const,
  };
  return {
    sessionRef,
    transcript,
    signature: Buffer.from('mobile-signature').toString('base64url'),
  };
}

test('desktop only issues a grant for a QR-bound, verified mobile transcript', () => {
  const authority = new DesktopPairingAuthority();
  const qr = authority.createQr({
    hubId: 'desktop-app',
    nodeId: 'desktop-node',
    desktopPublicKey: 'desktop-key',
    alpn: 'sovereign-apps/1',
  }).envelope;
  const value = proof(qr);
  const grant = authority.completePairing(qr.sessionRef, {
    ...value,
    verify: (signature, message, publicKey) =>
      Buffer.from(signature).toString() === 'mobile-signature' &&
      publicKey.byteLength > 0 &&
      Buffer.from(message).equals(buildPairingTranscript(value.transcript)),
  });
  assert.equal(grant.peerKey, 'mobile-key');
  assert.equal(grant.nodeId, 'mobile-node');
  assert.deepEqual(grant.capabilities, ['app.read']);
});

test('desktop rejects forged session binding and signatures before consuming the session', () => {
  const authority = new DesktopPairingAuthority();
  const qr = authority.createQr({
    hubId: 'desktop-app',
    nodeId: 'desktop-node',
    desktopPublicKey: 'desktop-key',
    alpn: 'sovereign-apps/1',
  }).envelope;
  const value = proof(qr);
  assert.throws(
    () =>
      authority.completePairing(qr.sessionRef, {
        ...value,
        transcript: { ...value.transcript, desktopNodeId: 'attacker-node' },
        verify: () => true,
      }),
    /not bound/,
  );
  assert.throws(
    () =>
      authority.completePairing(qr.sessionRef, {
        ...value,
        verify: () => false,
      }),
    /signature is invalid/,
  );
  const grant = authority.completePairing(qr.sessionRef, {
    ...value,
    verify: () => true,
  });
  assert.equal(grant.peerKey, 'mobile-key');
});
