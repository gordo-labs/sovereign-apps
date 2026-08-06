/**
 * Sovereign Apps Protocol — wire framing.
 *
 * Framing format (same as Music Hub's Iroh tunnel):
 *   [ 4 bytes: big-endian uint32 payload length ]
 *   [ N bytes: payload (JSON-encoded SovereignMessage) ]
 *
 * Max frame: 2 MB.
 */

const MAX_FRAME_BYTES = 2 * 1024 * 1024;
const HEADER_BYTES = 4;

export function encodeFrame(payload: Uint8Array): Uint8Array {
  if (payload.byteLength > MAX_FRAME_BYTES) {
    throw new Error(`Frame too large: ${payload.byteLength} > ${MAX_FRAME_BYTES}`);
  }
  const frame = new Uint8Array(HEADER_BYTES + payload.byteLength);
  new DataView(frame.buffer, frame.byteOffset, frame.byteLength).setUint32(0, payload.byteLength, false);
  frame.set(payload, HEADER_BYTES);
  return frame;
}

export function decodeFrameHeader(data: Uint8Array): { payloadLength: number; headerEnd: number } {
  if (data.byteLength < HEADER_BYTES) {
    throw new Error('Insufficient data for frame header');
  }
  return {
    payloadLength: new DataView(data.buffer, data.byteOffset, data.byteLength).getUint32(0, false),
    headerEnd: HEADER_BYTES,
  };
}

export function encodeMessage(msg: SovereignMessage): Uint8Array {
  const json = new TextEncoder().encode(JSON.stringify(msg));
  return encodeFrame(json);
}

export function parseMessage(frame: Uint8Array): SovereignMessage {
  return JSON.parse(new TextDecoder().decode(frame)) as SovereignMessage;
}

export { MAX_FRAME_BYTES };
