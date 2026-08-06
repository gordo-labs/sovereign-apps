/**
 * Sovereign Apps Protocol — authentication handshake.
 *
 * Challenge-response protocol for pairing peers over Iroh QUIC:
 *
 *   Desktop (challenger)                  Mobile (responder)
 *   │                                       │
 *   │── auth.challenge ────────────────────►│  {nonce, requested caps}
 *   │                                       │  sign(nonce) with Ed25519
 *   │◄── auth.response ─────────────────────│  {signature, publicKey, granted caps}
 *   │                                       │
 *   │  verify(signature, publicKey, nonce)  │
 *   │── auth.grant ────────────────────────►│  {capabilities, expiresAt}
 *   │                                       │  store pairing record
 *   │── paired (start using tunnel) ───────►│
 *
 * Key derivation: Ed25519 from the Iroh node key (32 bytes).
 */

import type {
  AuthChallenge,
  AuthResponse,
  AuthGrant,
  PairedPeer,
  PeerCapability,
  PairingSessionState,
} from './pairing.js';
import { PeerCapabilities } from './pairing.js';
import { secureRandom } from './secure-pairing.js';

/** Default capability set granted to a newly paired mobile peer. */
const DEFAULT_GRANTED: PeerCapability[] = [
  PeerCapabilities.APP_READ,
  PeerCapabilities.MEDIA_STREAM,
  PeerCapabilities.RELAY_USE,
];

/** Generate a 16-byte random nonce for challenge. */
export function generateNonce(): string {
  const buf = secureRandom(16);
  return uint8ToBase64Url(buf);
}

/** Convert Uint8Array to base64url string. */
function uint8ToBase64Url(buf: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < buf.byteLength; i++) {
    binary += String.fromCharCode(buf[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Build an auth challenge message.
 */
export function buildChallenge(
  challenger: string,
  requested: PeerCapability[] = DEFAULT_GRANTED,
): AuthChallenge {
  return {
    type: 'auth.challenge',
    version: 1,
    nonce: generateNonce(),
    challenger,
    requested,
  };
}

/**
 * Build an auth response by signing the nonce.
 *
 * @param challenge - The received challenge
 * @param signFn - Function that signs the nonce with Ed25519 secret key
 * @param publicKey - Base64url-encoded Ed25519 public key
 * @returns The auth response
 */
export function buildResponse(
  challenge: AuthChallenge,
  signFn: (data: Uint8Array) => Uint8Array,
  publicKey: string,
): AuthResponse {
  // Sign the nonce bytes
  const nonceBytes = base64UrlToUint8(challenge.nonce);
  const signatureBytes = signFn(nonceBytes);

  return {
    type: 'auth.response',
    version: 1,
    nonce: challenge.nonce,
    signature: uint8ToBase64Url(signatureBytes),
    publicKey,
    granted: challenge.requested.filter((c) =>
      DEFAULT_GRANTED.includes(c),
    ),
  };
}

/** Base64url to Uint8Array. */
function base64UrlToUint8(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '===';
  const decoded = atob(padded);
  const buf = new Uint8Array(decoded.length);
  for (let i = 0; i < decoded.length; i++) {
    buf[i] = decoded.charCodeAt(i);
  }
  return buf;
}

/**
 * Verify an auth response signature.
 *
 * @param response - The auth response to verify
 * @param originalNonce - The nonce from the challenge (before the responder wrapped it)
 * @param verifyFn - Function that verifies the signature against the nonce bytes
 * @returns true if the signature is valid
 */
export function verifyResponse(
  response: AuthResponse,
  originalNonce: string,
  verifyFn: (signature: Uint8Array, data: Uint8Array, publicKey: Uint8Array) => boolean,
): boolean {
  if (response.nonce !== originalNonce) return false;
  if (response.version !== 1) return false;

  const nonceBytes = base64UrlToUint8(originalNonce);
  const sigBytes = base64UrlToUint8(response.signature);
  const pubBytes = base64UrlToUint8(response.publicKey);

  return verifyFn(sigBytes, nonceBytes, pubBytes);
}

/**
 * Build an auth grant — confirms the capabilities the challenger allows.
 */
export function buildGrant(
  grantor: string,
  grantee: string,
  capabilities: PeerCapability[],
  expiresAt: string | null = null,
): AuthGrant {
  return {
    type: 'auth.grant',
    version: 1,
    grantor,
    grantee,
    capabilities,
    expiresAt,
  };
}

/**
 * Create a PairedPeer record from a completed auth grant.
 */
export function pairedPeerFromGrant(
  grant: AuthGrant,
  nodeId: string,
  publicKey: string,
  directAddrs: string[] = [],
): PairedPeer {
  return {
    hubId: grant.grantee,
    nodeId,
    publicKey,
    capabilities: grant.capabilities,
    pairedAt: new Date().toISOString(),
    expiresAt: grant.expiresAt,
    directAddrs,
  };
}

/**
 * Simple in-memory store for paired peers.
 */
export class PairedPeerStore {
  private peers = new Map<string, PairedPeer>();

  add(peer: PairedPeer): void {
    this.peers.set(peer.nodeId, peer);
  }

  get(nodeId: string): PairedPeer | undefined {
    return this.peers.get(nodeId);
  }

  remove(nodeId: string): boolean {
    return this.peers.delete(nodeId);
  }

  list(): PairedPeer[] {
    return [...this.peers.values()];
  }

  clear(): void {
    this.peers.clear();
  }
}
