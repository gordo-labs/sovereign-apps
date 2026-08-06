/**
 * Sovereign Apps Protocol — pairing and authentication types.
 *
 * Defines the QR payload format, fingerprint verification, and capability
 * exchange protocol used in Music Hub's HubPairing + MobileHubClient.
 *
 * Two-phase handshake:
 *   Phase 1 — QR pairing: desktop displays QR → mobile scans → registers
 *   Phase 2 — Auth handshake: challenge → response → capability grant
 */

import type { NodeId } from './types.js';

/** Current pairing payload version. */
export const PAIRING_VERSION = 1;

/** Kind marker for QR payloads. */
export const PAIRING_KIND = 'sovereign-pairing';

/** Authentication protocol version. */
export const AUTH_VERSION = 1;

/** Capabilities that can be granted during pairing. */
export const PeerCapabilities = {
  /** Read application data. */
  APP_READ: 'app.read',
  /** Write application data. */
  APP_WRITE: 'app.write',
  /** Stream media or real-time data. */
  MEDIA_STREAM: 'media.stream',
  /** Relay traffic for other peers on the mesh. */
  RELAY_PROVIDE: 'relay.provide',
  /** Use this peer's relay for connectivity. */
  RELAY_USE: 'relay.use',
} as const;

export type PeerCapability = (typeof PeerCapabilities)[keyof typeof PeerCapabilities];

/** Contents of the QR code for pairing. */
export type PairingQrPayload = {
  v: number;
  kind: typeof PAIRING_KIND;
  /** Logical hub/application ID. */
  hubId: string;
  /** Iroh node ID (z-base-32). */
  nodeId: string;
  /** Ed25519 public key for challenge/response auth. */
  publicKey: string | null;
  /** Optional bootstrap relay URL. */
  bootstrap: string | null;
  /** Optional WiFi-direct listen addresses. */
  directAddrs?: string[];
};

/** A challenge sent during the auth handshake. */
export type AuthChallenge = {
  type: 'auth.challenge';
  version: typeof AUTH_VERSION;
  /** Random nonce (base64url, 16 bytes). */
  nonce: string;
  /** Hub/node id that challenges. */
  challenger: string;
  /** List of requested capabilities. */
  requested: PeerCapability[];
};

/** A response to an auth challenge. */
export type AuthResponse = {
  type: 'auth.response';
  version: typeof AUTH_VERSION;
  /** Original nonce, signed by responder's Ed25519 key. */
  nonce: string;
  /** Signature over nonce + responder id (base64url). */
  signature: string;
  /** Responder's public key (base64url). */
  publicKey: string;
  /** Granted capabilities. */
  granted: PeerCapability[];
};

/** Final auth grant confirmed by the challenger. */
export type AuthGrant = {
  type: 'auth.grant';
  version: typeof AUTH_VERSION;
  /** Hub id of the grantor. */
  grantor: string;
  /** Hub id of the grantee. */
  grantee: string;
  /** List of confirmed capabilities. */
  capabilities: PeerCapability[];
  /** Expiry timestamp (ISO). Null = no expiry. */
  expiresAt: string | null;
};

/** Current state of a pairing session. */
export type PairingSessionState =
  | 'idle'
  | 'qr_generated'
  | 'mobile_scanned'
  | 'fingerprint_verified'
  | 'auth_handshake'
  | 'paired'
  | 'error';

/** Record of a completed pairing. */
export type PairedPeer = {
  hubId: string;
  nodeId: string;
  publicKey: string | null;
  capabilities: PeerCapability[];
  pairedAt: string;
  expiresAt: string | null;
  directAddrs: string[];
};

/** WiFi-direct discovery information for LAN pairing. */
export type LanPeerAdvertisement = {
  hubId: string;
  nodeId: string;
  /** LAN IP:port for direct Iroh connection. */
  addresses: string[];
  /** Application-level fingerprint for visual verification. */
  fingerprint: string;
};
