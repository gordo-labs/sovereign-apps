import {
  buildPairingQrEnvelope,
  PairingGrantStore,
  PairingSessionStore,
  intersectCapabilities,
  validatePairingTranscript,
  verifyTranscript,
  serializePairingQrEnvelope,
  type PairingCapabilities,
  type PairingGrant,
  type SecurePairingQrEnvelope,
  type SecurePairingProof,
  type SignatureVerifier,
} from '@sovereign-apps/protocol';

/** Desktop authority: pairing references are server-side and consumed exactly once. */
export class DesktopPairingAuthority {
  readonly sessions = new PairingSessionStore();
  readonly grants = new PairingGrantStore();
  private readonly pending = new Map<
    string,
    { envelope: SecurePairingQrEnvelope; allowed: PairingCapabilities }
  >();
  createQr(input: {
    hubId: string;
    nodeId: string;
    desktopPublicKey: string;
    alpn: string;
    bootstrap?: string;
    allowedCapabilities?: PairingCapabilities;
  }): { envelope: SecurePairingQrEnvelope; text: string } {
    const session = this.sessions.create();
    const envelope = buildPairingQrEnvelope({
      protocol: 'sovereign-apps/1',
      alpn: input.alpn,
      hubId: input.hubId,
      nodeId: input.nodeId,
      desktopPublicKey: input.desktopPublicKey,
      sessionRef: session.sessionRef,
      expiresAt: new Date(session.expiresAt).toISOString(),
      bootstrap: input.bootstrap,
    });
    this.pending.set(session.sessionRef, {
      envelope,
      allowed: input.allowedCapabilities ?? [
        'app.read',
        'app.write',
        'media.stream',
        'relay.provide',
        'relay.use',
      ],
    });
    return { envelope, text: serializePairingQrEnvelope(envelope) };
  }
  completePairing(
    sessionRef: string,
    input: SecurePairingProof & { verify: SignatureVerifier },
  ): PairingGrant {
    const pending = this.pending.get(sessionRef);
    if (!pending || input.sessionRef !== sessionRef) throw new Error('Unknown pairing session');
    const { envelope } = pending;
    const transcript = input.transcript;
    validatePairingTranscript(transcript);
    if (
      transcript.sessionRef !== sessionRef ||
      transcript.protocol !== envelope.protocol ||
      transcript.alpn !== envelope.alpn ||
      transcript.desktopPublicKey !== envelope.desktopPublicKey ||
      transcript.desktopNodeId !== envelope.nodeId ||
      transcript.expiresAt !== envelope.expiresAt
    )
      throw new Error('Pairing transcript is not bound to the displayed QR');
    if (!verifyTranscript(input.signature, transcript, transcript.mobilePublicKey, input.verify))
      throw new Error('Pairing transcript signature is invalid');
    this.sessions.consume(sessionRef);
    this.pending.delete(sessionRef);
    return this.grants.issue({
      peerKey: transcript.mobilePublicKey,
      nodeId: transcript.mobileNodeId,
      capabilities: intersectCapabilities(
        intersectCapabilities(transcript.granted, transcript.requested),
        pending.allowed,
      ),
    });
  }
}
