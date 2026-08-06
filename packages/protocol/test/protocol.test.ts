import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FrameDecoder,
  encodeFrame,
  MAX_FRAME_BYTES,
  EnvelopeDecoder,
  createEnvelope,
  encodeEnvelope,
  decodeEnvelope,
  parsePairingQrPayload,
  parsePresenceRecord,
} from '../dist/index.js';

const bytes = (value: string) => new TextEncoder().encode(value);

test('incremental framing handles byte-by-byte, split payload and coalesced frames', () => {
  const decoder = new FrameDecoder();
  const input = new Uint8Array([...encodeFrame(bytes('one')), ...encodeFrame(bytes('two'))]);
  const result: string[] = [];
  for (const byte of input)
    result.push(...decoder.push(new Uint8Array([byte])).map((x) => new TextDecoder().decode(x)));
  assert.deepEqual(result, ['one', 'two']);
  decoder.finish();
});

test('zero and over-limit lengths are rejected before allocation', () => {
  assert.throws(() => encodeFrame(new Uint8Array()));
  const zero = new Uint8Array([0, 0, 0, 0]);
  assert.throws(() => new FrameDecoder().push(zero), /must not be empty/);
  const over = new Uint8Array(4);
  new DataView(over.buffer).setUint32(0, MAX_FRAME_BYTES + 1);
  assert.throws(() => new FrameDecoder().push(over), /too large/);
});

test('envelope codec validates version/type/ids and rejects forbidden nested payload', () => {
  const envelope = createEnvelope('request', 'request-1', { action: 'ping' });
  const frame = encodeEnvelope(envelope);
  assert.deepEqual(decodeEnvelope(frame.subarray(4)), envelope);
  assert.throws(() => createEnvelope('request', '', {}));
  assert.throws(() =>
    decodeEnvelope(
      bytes(JSON.stringify({ version: 2, type: 'request', correlationId: 'x', payload: {} })),
    ),
  );
  assert.throws(
    () => createEnvelope('event', 'x', { nested: { accessToken: 'secret' } }),
    /Forbidden/,
  );
});

test('envelope stream decoder decodes coalesced frames and malformed JSON', () => {
  const input = new Uint8Array([
    ...encodeEnvelope(createEnvelope('event', 'a', { ok: true })),
    ...encodeEnvelope(createEnvelope('close', 'b', { code: 'done' })),
  ]);
  const decoder = new EnvelopeDecoder();
  assert.equal(decoder.pushEnvelopes(input).length, 2);
  assert.throws(() => decodeEnvelope(encodeFrame(bytes('{')).subarray(4)), /Malformed/);
});

test('pairing and presence objects are bounded and strict', () => {
  const pairing = {
    v: 1,
    kind: 'sovereign-pairing',
    hubId: 'hub',
    nodeId: 'node',
    publicKey: null,
    bootstrap: null,
  };
  assert.deepEqual(parsePairingQrPayload(pairing).kind, 'sovereign-pairing');
  assert.throws(() => parsePairingQrPayload({ ...pairing, unexpected: true }));
  const presence = {
    schemaVersion: 1,
    hubId: 'hub',
    transportPeerId: 'peer',
    issuedAt: '2026-01-01T00:00:00.000Z',
    expiresAt: '2026-01-01T00:01:00.000Z',
    signature: 'abcdefghijklmnop',
  };
  assert.deepEqual(parsePresenceRecord(presence).hubId, 'hub');
  assert.throws(() =>
    parsePresenceRecord({
      ...presence,
      candidates: [{ kind: 'direct', address: 'x', trackId: 'bad' }],
    }),
  );
});
