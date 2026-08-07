/**
 * Sovereign App Template — React Native pairing client.
 *
 * Mobile-side pairing flow for initial WiFi setup:
 *   1. Scan QR from desktop (or auto-discover via LAN)
 *   2. Parse pairing payload
 *   3. Verify fingerprint visually
 *   4. Complete auth handshake
 *   5. Store paired peer record
 *
 * Mirrors Music Hub's MobileHubClient architecture.
 */

import type {
  PairingQrPayload,
  AuthChallenge,
  AuthResponse,
  AuthGrant,
  PairedPeer,
  PeerCapability,
  LanPeerAdvertisement,
} from '@sovereign-apps/protocol';
import {
  HubPairing,
  buildResponse,
  generateNonce,
  deriveFingerprint,
  DEFAULT_LAN_PORT,
  ADVERTISE_INTERVAL_MS,
  LAN_SCAN_TIMEOUT_MS,
  buildLanAdvertisement,
  parseLanAdvertisement,
  parsePairingInput,
  buildPairingTranscript,
  type PairingGrant,
  type SecurePairingProof,
  type SecurePairingQrEnvelope,
} from '@sovereign-apps/protocol';

export type PairingState =
  'scanning' | 'qr_scanned' | 'fingerprint_verified' | 'handshake' | 'paired' | 'error';

export interface PairingEvent {
  type: PairingState;
  detail?: string;
  hubId?: string;
  fingerprint?: string;
  error?: string;
}

export type PairingEventHandler = (event: PairingEvent) => void;

/**
 * Mobile-side pairing client.
 * Handles QR scanning, LAN discovery, and auth handshake.
 */
export class MobilePairingClient {
  private listeners: PairingEventHandler[] = [];
  private state: PairingState = 'scanning';
  private paired: PairedPeer | null = null;
  private secureEnvelope: SecurePairingQrEnvelope | null = null;
  private scanTimeout?: ReturnType<typeof setTimeout>;

  constructor() {
    this.state = 'scanning';
  }

  /** Register a pairing event handler. */
  onEvent(handler: PairingEventHandler): void {
    this.listeners.push(handler);
  }

  /** Remove an event handler. */
  offEvent(handler: PairingEventHandler): void {
    const idx = this.listeners.indexOf(handler);
    if (idx >= 0) this.listeners.splice(idx, 1);
  }

  /** Emit a state change event. */
  private emit(event: PairingEvent): void {
    for (const listener of this.listeners) listener(event);
  }

  /**
   * Handle a scanned QR payload.
   * Sets state to 'qr_scanned', emits the event.
   */
  handleQrScan(
    qrData: string,
    options: { allowManual?: boolean } = {},
  ):
    | {
        hubId: string;
        nodeId: string;
        fingerprint: string;
        bootstrap: string | null;
      }
    | { error: string } {
    try {
      const secure = parsePairingInput(qrData, options);
      this.secureEnvelope = secure;
      const parsed = {
        hubId: secure.hubId,
        nodeId: secure.nodeId,
        publicKey: secure.desktopPublicKey,
        bootstrap: secure.bootstrap ?? null,
        directAddrs: [],
      };
      const fingerprint = HubPairing.fingerprint(parsed.nodeId);
      this.state = 'qr_scanned';
      this.emit({
        type: 'qr_scanned',
        hubId: parsed.hubId,
        fingerprint,
      });
      return {
        hubId: parsed.hubId,
        nodeId: parsed.nodeId,
        fingerprint,
        bootstrap: parsed.bootstrap,
      };
    } catch (err) {
      this.state = 'error';
      const msg = err instanceof Error ? err.message : String(err);
      this.emit({ type: 'error', error: msg });
      return { error: msg };
    }
  }

  /** Diagnostic-only fallback; production UI must use camera/deep-link input. */
  handleManualDiagnosticInput(qrData: string) {
    return this.handleQrScan(qrData, { allowManual: true });
  }

  /**
   * User has verified the fingerprint matches the desktop screen.
   * Transitions to 'fingerprint_verified'.
   */
  verifyFingerprint(): void {
    if (this.state !== 'qr_scanned') return;
    this.state = 'fingerprint_verified';
    this.emit({ type: 'fingerprint_verified' });
  }

  /**
   * Build an auth response for a received challenge.
   *
   * @param challenge - The challenge from the desktop peer
   * @param signFn - Ed25519 signing function
   * @param publicKey - Base64url public key
   * @returns The response and parsed data
   */
  buildAuthResponse(
    challenge: AuthChallenge,
    signFn: (data: Uint8Array) => Uint8Array,
    publicKey: string,
  ): {
    response: AuthResponse;
  } {
    if (this.state !== 'fingerprint_verified') {
      throw new Error('Must verify fingerprint before auth handshake');
    }
    const response = buildResponse(challenge, signFn, publicKey);
    this.state = 'handshake';
    this.emit({ type: 'handshake', detail: 'response sent' });
    return { response };
  }

  /** Build the v2 transcript proof consumed by DesktopPairingAuthority. */
  buildSecureProof(input: {
    mobilePublicKey: string;
    mobileNodeId: string;
    requested: PeerCapability[];
    granted: PeerCapability[];
    nonce: string;
    sign: (transcript: Uint8Array) => string;
  }): SecurePairingProof {
    if (this.state !== 'fingerprint_verified' || !this.secureEnvelope)
      throw new Error('Must scan and verify the pairing QR before secure proof');
    const transcript = {
      protocol: this.secureEnvelope.protocol,
      alpn: this.secureEnvelope.alpn,
      sessionRef: this.secureEnvelope.sessionRef,
      desktopPublicKey: this.secureEnvelope.desktopPublicKey,
      desktopNodeId: this.secureEnvelope.nodeId,
      mobilePublicKey: input.mobilePublicKey,
      mobileNodeId: input.mobileNodeId,
      nonce: input.nonce,
      expiresAt: this.secureEnvelope.expiresAt,
      requested: input.requested,
      granted: input.granted,
    } as const;
    const signature = input.sign(buildPairingTranscript(transcript));
    this.state = 'handshake';
    this.emit({ type: 'handshake', detail: 'secure transcript sent' });
    return { sessionRef: this.secureEnvelope.sessionRef, transcript, signature };
  }

  /** Accept only a grant bound to the mobile identity and negotiated capabilities. */
  handleSecureGrant(grant: PairingGrant, proof: SecurePairingProof): PairedPeer {
    if (grant.peerKey !== proof.transcript.mobilePublicKey)
      throw new Error('Pairing grant peer identity mismatch');
    if (grant.nodeId !== proof.transcript.mobileNodeId)
      throw new Error('Pairing grant node identity mismatch');
    if (grant.capabilities.some((cap) => !proof.transcript.granted.includes(cap)))
      throw new Error('Pairing grant capability escalation');
    const peer: PairedPeer = {
      hubId: proof.transcript.desktopNodeId,
      nodeId: proof.transcript.desktopNodeId,
      publicKey: proof.transcript.desktopPublicKey,
      capabilities: [...grant.capabilities],
      pairedAt: grant.issuedAt,
      expiresAt: grant.expiresAt,
      directAddrs: [],
    };
    this.paired = peer;
    this.state = 'paired';
    this.emit({ type: 'paired', hubId: peer.hubId });
    return peer;
  }

  /**
   * Handle a grant from the desktop peer.
   */
  handleGrant(grant: AuthGrant, nodeId: string, publicKey: string): PairedPeer {
    const peer = {
      hubId: grant.grantor,
      nodeId,
      publicKey,
      capabilities: grant.capabilities,
      pairedAt: new Date().toISOString(),
      expiresAt: grant.expiresAt,
      directAddrs: [],
    };
    this.paired = peer;
    this.state = 'paired';
    this.emit({ type: 'paired', hubId: grant.grantor });
    return peer;
  }

  /** Get current state. */
  getState(): PairingState {
    return this.state;
  }

  /** Get the paired peer record. */
  getPairedPeer(): PairedPeer | null {
    return this.paired;
  }

  /** Reset the client for a new pairing session. */
  reset(): void {
    this.state = 'scanning';
    this.paired = null;
    this.secureEnvelope = null;
    if (this.scanTimeout) clearTimeout(this.scanTimeout);
    this.emit({ type: 'scanning' });
  }
}
