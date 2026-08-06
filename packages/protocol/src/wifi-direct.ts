/**
 * Sovereign Apps Protocol — WiFi-direct LAN peer discovery.
 *
 * Desktop peers advertise their Iroh node over LAN via UDP multicast,
 * and mobile peers discover them to initiate the QR-pairing or direct
 * connection flow.
 *
 * Architecture:
 *   Desktop: starts LAN advertisement service (broadcast UDP)
 *   Mobile:  listens on LAN for advertisements, presents list to user
 *
 * This provides the "initial WiFi connection" flow Gordo described:
 *   - Desktop generates QR + advertises via LAN
 *   - Mobile scans QR OR discovers via LAN advertisement
 *   - Pairing handshake completes over that channel
 *   - Subsequent connections use Iroh QUIC (relay or direct hole-punch)
 */

import type { LanPeerAdvertisement } from './pairing.js';
import { z } from 'zod';

/** Default UDP port for LAN peer advertisements. */
export const DEFAULT_LAN_PORT = 42069;

/** Default multicast/broadcast address (IPv4 link-local). */
export const DEFAULT_LAN_BROADCAST = '255.255.255.255';

/** How often to re-advertise (ms). */
export const ADVERTISE_INTERVAL_MS = 2_000;

/** How long to wait for LAN peers before timing out a scan (ms). */
export const LAN_SCAN_TIMEOUT_MS = 10_000;

/** Magic bytes at the start of every LAN advertisement packet. */
const LAN_MAGIC = new Uint8Array([0x53, 0x4f, 0x56, 0x01]); // "SOV\x01"

/** Build a LAN advertisement payload from peer data. */
export function buildLanAdvertisement(peer: LanPeerAdvertisement): Uint8Array {
  const payload = JSON.stringify(peer);
  const encoded = new TextEncoder().encode(payload);
  const frame = new Uint8Array(LAN_MAGIC.byteLength + encoded.byteLength);
  frame.set(LAN_MAGIC, 0);
  frame.set(encoded, LAN_MAGIC.byteLength);
  return frame;
}

/** Parse a received LAN advertisement packet. Returns null if invalid. */
export function parseLanAdvertisement(data: Uint8Array): LanPeerAdvertisement | null {
  if (data.byteLength < LAN_MAGIC.byteLength) return null;
  for (let i = 0; i < LAN_MAGIC.byteLength; i++) {
    if (data[i] !== LAN_MAGIC[i]) return null;
  }
  try {
    const json = new TextDecoder().decode(data.subarray(LAN_MAGIC.byteLength));
    const parsed: unknown = JSON.parse(json);
    const result = z
      .object({
        hubId: z.string().min(1).max(128),
        nodeId: z.string().min(1).max(128),
        addresses: z.array(z.string().min(1).max(512)).min(1).max(16),
        fingerprint: z.string().min(1).max(64),
      })
      .strict()
      .safeParse(parsed);
    return result.success ? (result.data as LanPeerAdvertisement) : null;
  } catch {
    return null;
  }
}

/**
 * Derive a short human-readable fingerprint from a peer's node ID.
 * Used for visual verification: "does the phone show the same fingerprint as the desktop?"
 */
export function deriveFingerprint(nodeId: string): string {
  // Take first 12 chars of the z-base-32 node id, then add a checksum char
  const prefix = nodeId.slice(0, 12).toUpperCase();
  let checksum = 0;
  for (let i = 0; i < prefix.length; i++) {
    checksum = (checksum + prefix.charCodeAt(i)) % 36;
  }
  const checksumChar = checksum.toString(36).toUpperCase();
  return `${prefix}-${checksumChar}`;
}
