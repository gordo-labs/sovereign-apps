import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCandidate, ReactNativeIrohEndpoint } from '../dist/transport-adapter.js';

const fakeConnection = () => {
  const messages = new Set();
  const closes = new Set();
  const errors = new Set();
  return {
    send: async (data) => { if (!data.length) throw new Error('empty'); },
    onMessage: (fn) => (messages.add(fn), () => messages.delete(fn)),
    onClose: (fn) => (closes.add(fn), () => closes.delete(fn)),
    onError: (fn) => (errors.add(fn), () => errors.delete(fn)),
    isClosed: () => false,
    close: async () => { for (const fn of closes) fn(); },
    emit: (data) => { for (const fn of messages) fn(data); },
  };
};

function fakeBridge() {
  const connection = fakeConnection();
  const session = {
    openStream: async () => connection,
    isClosed: () => false,
    close: async () => {},
  };
  return {
    bridgeVersion: () => '0.2.0-test', nodeId: () => 'local-z32', start: async () => {},
    stop: async () => {}, isRunning: () => true,
    connect: async () => connection, connectTarget: async () => connection,
    openSession: async () => session, openTargetSession: async () => session,
    connection,
  };
}

test('normalizes direct and relay candidates into typed targets', () => {
  assert.deepEqual(normalizeCandidate({ id: 'peer', kind: 'iroh', address: 'ip:192.0.2.1:4433' }).target, {
    kind: 'endpoint-address', nodeId: 'peer', directAddresses: ['192.0.2.1:4433'], relayUrl: null,
  });
  assert.deepEqual(normalizeCandidate({ id: 'peer', kind: 'iroh', address: 'https://relay.example' }).target, {
    kind: 'endpoint-address', nodeId: 'peer', directAddresses: [], relayUrl: 'https://relay.example',
  });
});

test('rejects display-only node ids and mismatched JSON tickets', () => {
  assert.throws(() => normalizeCandidate({ id: 'peer', kind: 'iroh', address: 'peer' }), /not dialable/);
  assert.throws(() => normalizeCandidate({ id: 'peer', kind: 'iroh', address: '{"id":"other","addrs":["https://relay.example"]}' }), /does not match/);
});

test('endpoint lifecycle is explicit and stream frames are not double-framed', async () => {
  const bridge = fakeBridge();
  const endpoint = new ReactNativeIrohEndpoint({ bridge, candidates: [] });
  assert.equal(endpoint.state, 'idle');
  await endpoint.start({ signal: new AbortController().signal });
  assert.equal(endpoint.state, 'ready');
  const session = await endpoint.connect({ id: 'peer', kind: 'iroh', address: '203.0.113.2:4433' });
  const stream = await session.openStream();
  await stream.write(Uint8Array.of(1, 2, 3));
  bridge.connection.emit(Uint8Array.of(4, 5));
  assert.deepEqual(await stream.read(), Uint8Array.of(4, 5));
  await session.close('test');
  await endpoint.stop();
  assert.equal(endpoint.state, 'stopped');
});

test('native unavailable does not become ready', async () => {
  const bridge = fakeBridge();
  bridge.start = async () => { throw new Error('TurboModule missing'); };
  const endpoint = new ReactNativeIrohEndpoint({ bridge });
  await assert.rejects(endpoint.start({ signal: new AbortController().signal }), /failed to start/);
  assert.equal(endpoint.state, 'failed');
});
