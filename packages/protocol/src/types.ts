/**
 * Sovereign Apps Protocol — core types.
 *
 * Matches the minimal Iroh surface used in Music Hub's sovereign networking:
 *   - @momics/iroh-http-node (Electron desktop)
 *   - rust/iroh_mobile_bridge (React Native via UniFFI)
 */

/** An Iroh node identity. Peer ID is the z-base-32 node id string. */
export type NodeId = string;

/** ALPN (Application-Layer Protocol Negotiation) string for QUIC streams. */
export type Alpn = string;

/** Version negotiated on the Iroh stream. Never silently decode another version. */
export const WIRE_VERSION = 1 as const;
export const WIRE_ALPN = 'sovereign-apps/1' as const;
export const MAX_ID_BYTES = 128;
export const MAX_CORRELATION_ID_BYTES = 128;
export const MAX_MESSAGE_TYPE_BYTES = 64;
export const MAX_PAYLOAD_BYTES = 2 * 1024 * 1024;

/** A dialable Iroh peer address. */
export type PeerAddr = {
  nodeId: NodeId;
  /** Optional relay URL for off-LAN connectivity (n0 relay by default). */
  relayUrl?: string;
  /** Optional direct UDP addresses for hole-punched LAN peers. */
  directAddrs?: string[];
};

/** A framed message sent over an Iroh QUIC bi-directional stream. */
export type FramedMessage = {
  /** 4-byte big-endian length prefix */
  byteLength: number;
  payload: Uint8Array;
};

/** Generic JSON envelope sent over sovereign tunnels. */
export type SovereignMessage = {
  /** Message type discriminator */
  type: string;
  /** ISO timestamp of the sender */
  timestamp: string;
  /** Sender node id */
  from: NodeId;
  /** Free-form payload */
  payload: Record<string, unknown>;
};

export type WireMessageType = 'request' | 'response' | 'event' | 'error' | 'close';

/** Versioned, bounded envelope. Payload is codec-specific and untrusted. */
export type WireEnvelope = {
  version: typeof WIRE_VERSION;
  type: WireMessageType;
  correlationId: string;
  payload: unknown;
};

export type WireError = {
  code: string;
  message: string;
  retryable?: boolean;
};

export type WireClose = {
  code: string;
  reason?: string;
};

/** Transport status reported by a peer endpoint. */
export type TransportStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

/** Default ALPN used by the sovereign-apps protocol. */
export const DEFAULT_ALPN = WIRE_ALPN;
