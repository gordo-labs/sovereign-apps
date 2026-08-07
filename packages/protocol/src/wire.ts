import { encodeFrame, FrameDecoder, MAX_FRAME_BYTES } from './framing.js';
import { parseWireEnvelope } from './schemas.js';
import { WIRE_VERSION, type WireEnvelope, type WireMessageType } from './types.js';

const encoder = new TextEncoder();

export function createEnvelope(
  type: WireMessageType,
  correlationId: string,
  payload: unknown,
): WireEnvelope {
  return parseWireEnvelope({ version: WIRE_VERSION, type, correlationId, payload });
}

export function encodeEnvelope(envelope: WireEnvelope): Uint8Array {
  const valid = parseWireEnvelope(envelope);
  return encodeFrame(encoder.encode(JSON.stringify(valid)));
}

export function decodeEnvelope(payload: Uint8Array): WireEnvelope {
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(payload));
  } catch (error) {
    throw new Error(
      `Malformed envelope JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  return parseWireEnvelope(value);
}

/** Envelope stream decoder; use on raw Node/Iroh streams only. */
export class EnvelopeDecoder extends FrameDecoder {
  constructor(maxFrameBytes = MAX_FRAME_BYTES) {
    super({ maxFrameBytes });
  }
  pushEnvelopes(chunk: Uint8Array): WireEnvelope[] {
    return this.push(chunk).map(decodeEnvelope);
  }
}

export const request = (id: string, payload: unknown) => createEnvelope('request', id, payload);
export const response = (id: string, payload: unknown) => createEnvelope('response', id, payload);
export const event = (id: string, payload: unknown) => createEnvelope('event', id, payload);
export const error = (id: string, payload: unknown) => createEnvelope('error', id, payload);
export const close = (id: string, payload: unknown) => createEnvelope('close', id, payload);
