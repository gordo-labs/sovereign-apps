/** Wire framing shared by every transport adapter.
 *
 * A stream is a sequence of `[uint32be length][payload]` records.  The
 * React-Native Iroh bridge already frames bytes at its native boundary; an
 * adapter using that API must therefore pass complete protocol envelopes and
 * must not call `encodeFrame` a second time.
 */

export const HEADER_BYTES = 4;
export const MAX_FRAME_BYTES = 2 * 1024 * 1024;

export type FrameDecoderOptions = { maxFrameBytes?: number };

export function encodeFrame(payload: Uint8Array, maxFrameBytes = MAX_FRAME_BYTES): Uint8Array {
  if (payload.byteLength === 0) throw new Error('Frame payload must not be empty');
  if (payload.byteLength > maxFrameBytes) {
    throw new Error(`Frame too large: ${payload.byteLength} > ${maxFrameBytes}`);
  }
  const frame = new Uint8Array(HEADER_BYTES + payload.byteLength);
  new DataView(frame.buffer).setUint32(0, payload.byteLength, false);
  frame.set(payload, HEADER_BYTES);
  return frame;
}

export function decodeFrameHeader(
  data: Uint8Array,
  maxFrameBytes = MAX_FRAME_BYTES,
): { payloadLength: number; headerEnd: number } {
  if (data.byteLength < HEADER_BYTES) throw new Error('Insufficient data for frame header');
  const payloadLength = new DataView(data.buffer, data.byteOffset, HEADER_BYTES).getUint32(
    0,
    false,
  );
  if (payloadLength === 0) throw new Error('Frame payload must not be empty');
  if (payloadLength > maxFrameBytes) {
    throw new Error(`Frame too large: ${payloadLength} > ${maxFrameBytes}`);
  }
  return { payloadLength, headerEnd: HEADER_BYTES };
}

/** Incremental decoder. `push` may receive arbitrary fragmentation/coalescing. */
export class FrameDecoder {
  private pending = new Uint8Array(0);
  private readonly maxFrameBytes: number;

  constructor(options: FrameDecoderOptions = {}) {
    this.maxFrameBytes = options.maxFrameBytes ?? MAX_FRAME_BYTES;
    if (!Number.isSafeInteger(this.maxFrameBytes) || this.maxFrameBytes <= 0) {
      throw new Error('maxFrameBytes must be a positive safe integer');
    }
  }

  push(chunk: Uint8Array): Uint8Array[] {
    if (chunk.byteLength === 0) return [];
    const combined = new Uint8Array(this.pending.byteLength + chunk.byteLength);
    combined.set(this.pending);
    combined.set(chunk, this.pending.byteLength);
    const frames: Uint8Array[] = [];
    let offset = 0;
    while (combined.byteLength - offset >= HEADER_BYTES) {
      const header = combined.subarray(offset, offset + HEADER_BYTES);
      const { payloadLength } = decodeFrameHeader(header, this.maxFrameBytes);
      const end = offset + HEADER_BYTES + payloadLength;
      if (end > combined.byteLength) break;
      frames.push(combined.slice(offset + HEADER_BYTES, end));
      offset = end;
    }
    this.pending = combined.slice(offset);
    return frames;
  }

  /** A stream ending with bytes here is a truncated protocol frame. */
  finish(): void {
    if (this.pending.byteLength > 0) {
      throw new Error(`Incomplete frame: ${this.pending.byteLength} trailing bytes`);
    }
  }

  reset(): void {
    this.pending = new Uint8Array(0);
  }
  get pendingBytes(): number {
    return this.pending.byteLength;
  }
}

export function encodeMessage(msg: import('./types.js').SovereignMessage): Uint8Array {
  return encodeFrame(new TextEncoder().encode(JSON.stringify(msg)));
}

/** Compatibility helper for callers that already removed the length header. */
export function parseMessage(frame: Uint8Array): import('./types.js').SovereignMessage {
  const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(frame));
  if (!value || typeof value !== 'object') throw new Error('Message must be an object');
  return value as import('./types.js').SovereignMessage;
}
