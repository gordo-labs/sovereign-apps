/**
 * Sovereign Apps Protocol — HubPairing service.
 *
 * Complete pairing flow for desktop ↔ mobile initial WiFi setup.
 * Premounted from Music Hub's HubPairing + MobileHubClient implementation.
 *
 * Flow:
 *   1. Desktop starts Iroh endpoint, generates pairing QR
 *   2. Desktop also advertises via LAN UDP broadcast (WiFi-direct)
 *   3. Mobile scans QR or discovers via LAN
 *   4. Handshake: challenge → response → grant (capability-based auth)
 *   5. Paired peer record stored; subsequent connections use Iroh QUIC
 */

import type {
  PairingQrPayload,
  PairedPeer,
  PeerCapability,
  LanPeerAdvertisement,
  PairingSessionState,
} from './pairing.js';
import { PAIRING_VERSION, PAIRING_KIND, PeerCapabilities } from './pairing.js';
import { deriveFingerprint } from './wifi-direct.js';
import { parsePairingQrPayload } from './schemas.js';
import {
  buildChallenge,
  buildResponse,
  buildGrant,
  verifyResponse,
  pairedPeerFromGrant,
  PairedPeerStore,
  generateNonce,
} from './auth.js';

/** Default capabilities to request during pairing. */
const DEFAULT_REQUESTED: PeerCapability[] = [
  PeerCapabilities.APP_READ,
  PeerCapabilities.MEDIA_STREAM,
];

/** Builder and parser for QR payloads. */
export class HubPairing {
  /**
   * Build the QR payload for a desktop endpoint.
   *
   * @param hubId - Logical hub/application identifier
   * @param nodeId - Iroh node ID (z-base-32)
   * @param publicKey - Ed25519 public key (base64url), null if unavailable
   * @param bootstrap - Optional relay URL
   * @param directAddrs - Optional direct LAN addresses
   */
  static buildQrPayload({
    hubId,
    nodeId,
    publicKey = null,
    bootstrap = null,
    directAddrs,
  }: {
    hubId: string;
    nodeId: string;
    publicKey?: string | null;
    bootstrap?: string | null;
    directAddrs?: string[];
  }): PairingQrPayload {
    return {
      v: PAIRING_VERSION,
      kind: PAIRING_KIND,
      hubId,
      nodeId,
      publicKey,
      bootstrap,
      directAddrs,
    };
  }

  /**
   * Parse a QR payload (either raw string or pre-parsed object).
   */
  static parseQrPayload(raw: string | PairingQrPayload): {
    hubId: string;
    nodeId: string;
    publicKey: string | null;
    bootstrap: string | null;
    directAddrs: string[];
  } {
    let decoded: unknown;
    try {
      decoded = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch {
      throw new Error('Invalid sovereign pairing QR JSON');
    }
    const payload = parsePairingQrPayload(decoded) as PairingQrPayload;
    return {
      hubId: payload.hubId,
      nodeId: payload.nodeId,
      publicKey: payload.publicKey ?? null,
      bootstrap: payload.bootstrap ?? null,
      directAddrs: payload.directAddrs ?? [],
    };
  }

  /**
   * Derive a visual fingerprint from the node ID for side-channel verification.
   * The mobile user compares: "Does this match what the desktop screen shows?"
   */
  static fingerprint(nodeId: string): string {
    return deriveFingerprint(nodeId);
  }

  /**
   * Serialize QR payload to a JSON string for QR code generation.
   */
  static qrCodeString(payload: PairingQrPayload): string {
    return JSON.stringify(payload);
  }
}

/**
 * Desktop-side pairing state machine.
 */
export class DesktopPairingSession {
  readonly peerId: string;
  readonly nodeId: string;
  readonly publicKey: string | null;
  private state: PairingSessionState = 'idle';
  private challenge?: ReturnType<typeof buildChallenge>;
  private paired?: PairedPeer;

  constructor({
    peerId,
    nodeId,
    publicKey = null,
  }: {
    peerId: string;
    nodeId: string;
    publicKey?: string | null;
  }) {
    this.peerId = peerId;
    this.nodeId = nodeId;
    this.publicKey = publicKey ?? null;
  }

  getState(): PairingSessionState {
    return this.state;
  }

  /** Build the QR payload for this desktop session. */
  buildQrPayload(options?: {
    bootstrap?: string | null;
    directAddrs?: string[];
  }): PairingQrPayload {
    const payload = HubPairing.buildQrPayload({
      hubId: this.peerId,
      nodeId: this.nodeId,
      publicKey: this.publicKey,
      bootstrap: options?.bootstrap ?? null,
      directAddrs: options?.directAddrs,
    });
    this.state = 'qr_generated';
    return payload;
  }

  /** A mobile peer has scanned the QR. Transition state. */
  markScanned(): void {
    if (this.state !== 'qr_generated') return;
    this.state = 'mobile_scanned';
  }

  /** Build a challenge for the mobile peer. */
  buildChallenge(requested?: PeerCapability[]): ReturnType<typeof buildChallenge> {
    this.challenge = buildChallenge(this.peerId, requested ?? DEFAULT_REQUESTED);
    this.state = 'auth_handshake';
    return this.challenge;
  }

  /**
   * Verify a mobile peer's auth response and build the grant.
   *
   * @param response - The response from the mobile peer
   * @param verifyFn - Ed25519 verification function
   */
  handleResponse(
    response: Parameters<typeof verifyResponse>[0],
    verifyFn: Parameters<typeof verifyResponse>[2],
  ): ReturnType<typeof buildGrant> {
    if (!this.challenge) throw new Error('No challenge sent yet');
    const ok = verifyResponse(response, this.challenge.nonce, verifyFn);
    if (!ok) {
      this.state = 'error';
      throw new Error('Auth response verification failed');
    }
    this.state = 'fingerprint_verified';

    // Grant the same capabilities the mobile requested
    const grant = buildGrant(this.peerId, response.granted.join('+'), response.granted, null);
    this.paired = pairedPeerFromGrant(grant, /* nodeId */ '', /* publicKey */ '', []);
    this.paired.nodeId = /* we'd store the mobile's nodeId here */ 'mobile-peer';
    this.paired.publicKey = response.publicKey;
    this.paired.pairedAt = new Date().toISOString();
    this.state = 'paired';
    return grant;
  }

  /** Get the final paired peer record. */
  getPaired(): PairedPeer | null {
    return this.paired ?? null;
  }

  /** Reset the session. */
  reset(): void {
    this.state = 'idle';
    this.challenge = undefined;
    this.paired = undefined;
  }
}
