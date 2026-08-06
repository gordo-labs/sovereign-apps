import {
  buildPairingQrEnvelope,
  PairingGrantStore,
  PairingSessionStore,
  serializePairingQrEnvelope,
  type PairingCapabilities,
  type PairingGrant,
  type SecurePairingQrEnvelope,
} from '@sovereign-apps/protocol';

/** Desktop authority: pairing references are server-side and consumed exactly once. */
export class DesktopPairingAuthority {
  readonly sessions = new PairingSessionStore();
  readonly grants = new PairingGrantStore();
  createQr(input: { hubId: string; nodeId: string; desktopPublicKey: string; alpn: string; bootstrap?: string }): { envelope: SecurePairingQrEnvelope; text: string } {
    const session = this.sessions.create();
    const envelope = buildPairingQrEnvelope({
      protocol: 'sovereign-apps/1', alpn: input.alpn, hubId: input.hubId, nodeId: input.nodeId,
      desktopPublicKey: input.desktopPublicKey, sessionRef: session.sessionRef,
      expiresAt: new Date(session.expiresAt).toISOString(), bootstrap: input.bootstrap,
    });
    return { envelope, text: serializePairingQrEnvelope(envelope) };
  }
  completePairing(sessionRef: string, input: { peerKey: string; nodeId: string; capabilities: PairingCapabilities }): PairingGrant {
    this.sessions.consume(sessionRef);
    return this.grants.issue(input);
  }
}
