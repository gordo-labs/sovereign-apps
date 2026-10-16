import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeStreamHello } from '../../protocol/dist/index.js';
import {
  normalizeCandidate,
  normalizeCandidates,
  ReactNativeIrohEndpoint,
} from '../dist/transport-adapter.js';
import { NATIVE_TCP_STREAM_PREAMBLE } from '../../protocol/dist/index.js';

const fakeConnection = (responseAlpn = null) => {
  const messages = new Set();
  const closes = new Set();
  const errors = new Set();
  return {
    send: async (data) => {
      if (!data.length) throw new Error('empty');
      // The fake peer mirrors the application hello; real peers validate the
      // same framed version/domain before exposing application messages.
      if (data.length >= 9 && data[4] === 0x53 && data[5] === 0x41 && data[6] === 0x48) {
        const response = responseAlpn ? encodeStreamHello(responseAlpn) : new Uint8Array(data);
        for (const fn of messages) fn(response);
      }
    },
    onMessage: (fn) => (messages.add(fn), () => messages.delete(fn)),
    onClose: (fn) => (closes.add(fn), () => closes.delete(fn)),
    onError: (fn) => (errors.add(fn), () => errors.delete(fn)),
    isClosed: () => false,
    close: async () => {
      for (const fn of closes) fn();
    },
    emit: (data) => {
      for (const fn of messages) fn(data);
    },
  };
};

function fakeBridge(responseAlpn = null) {
  const connection = fakeConnection(responseAlpn);
  let lastTargetOptions = null;
  const session = {
    openStream: async () => connection,
    isClosed: () => false,
    close: async () => {},
  };
  return {
    bridgeVersion: () => '0.2.0-test',
    nodeId: () => 'local-z32',
    start: async () => {},
    stop: async () => {},
    isRunning: () => true,
    connect: async () => connection,
    connectTarget: async () => connection,
    openSession: async () => session,
    openTargetSession: async (options) => {
      lastTargetOptions = options;
      return session;
    },
    connection,
    lastTargetOptions: () => lastTargetOptions,
  };
}

test('normalizes direct and relay candidates into typed targets', () => {
  assert.deepEqual(
    normalizeCandidate({ id: 'peer', kind: 'iroh', address: 'ip:192.0.2.1:4433' }).target,
    {
      kind: 'endpoint-address',
      nodeId: 'peer',
      directAddresses: ['192.0.2.1:4433'],
      relayUrl: null,
    },
  );
  assert.deepEqual(
    normalizeCandidate({ id: 'peer', kind: 'iroh', address: 'https://relay.example' }).target,
    {
      kind: 'endpoint-address',
      nodeId: 'peer',
      directAddresses: [],
      relayUrl: 'https://relay.example',
    },
  );
});

test('rejects display-only node ids and mismatched JSON tickets', () => {
  assert.throws(
    () => normalizeCandidate({ id: 'peer', kind: 'iroh', address: 'peer' }),
    /not dialable/,
  );
  assert.throws(
    () =>
      normalizeCandidate({
        id: 'peer',
        kind: 'iroh',
        address: '{"id":"other","addrs":["https://relay.example"]}',
      }),
    /does not match/,
  );
});

test('combines direct and relay candidates for the same endpoint target', () => {
  const direct = {
    id: 'peer',
    kind: 'direct',
    address: '{"id":"peer","addrs":["192.168.1.10:42424"]}',
  };
  const relay = { id: 'peer', kind: 'relay', address: 'https://relay.example' };
  assert.deepEqual(normalizeCandidates([direct, relay]).target, {
    kind: 'endpoint-address',
    nodeId: 'peer',
    directAddresses: ['192.168.1.10:42424'],
    relayUrl: 'https://relay.example',
  });
  assert.throws(
    () => normalizeCandidates([direct, { ...relay, id: 'other' }]),
    /same non-empty Iroh node/,
  );
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

test('connect passes all configured paths to the bridge in one typed dial', async () => {
  const bridge = fakeBridge();
  const direct = {
    id: 'peer',
    kind: 'direct',
    address: '{"id":"peer","addrs":["192.168.1.10:42424"]}',
  };
  const relay = { id: 'peer', kind: 'relay', address: 'https://relay.example' };
  const endpoint = new ReactNativeIrohEndpoint({ bridge, candidates: [direct, relay] });
  await endpoint.start({ signal: new AbortController().signal });
  await endpoint.connect(direct);
  assert.deepEqual(bridge.lastTargetOptions(), {
    target: {
      kind: 'endpoint-address',
      nodeId: 'peer',
      directAddresses: ['192.168.1.10:42424'],
      relayUrl: 'https://relay.example',
    },
    alpn: 'sovereign-apps/1',
    timeoutMs: 4_500,
  });
});

test('native unavailable does not become ready', async () => {
  const bridge = fakeBridge();
  bridge.start = async () => {
    throw new Error('TurboModule missing');
  };
  const endpoint = new ReactNativeIrohEndpoint({ bridge });
  await assert.rejects(endpoint.start({ signal: new AbortController().signal }), /failed to start/);
  assert.equal(endpoint.state, 'failed');
});

test('stream hello rejects a peer advertising a different application domain', async () => {
  const bridge = fakeBridge('other-app/1');
  const endpoint = new ReactNativeIrohEndpoint({ bridge });
  await endpoint.start({ signal: new AbortController().signal });
  const session = await endpoint.connect({ id: 'peer', kind: 'iroh', address: '203.0.113.2:4433' });
  await assert.rejects(() => session.openStream(), /mismatch/);
});

test('bridge 0.3 TCP forwarder uses the paired peer target, shared ALPN and neutral preamble', async () => {
  const bridge = fakeBridge();
  let options;
  let stopped = false;
  bridge.startTcpForwarder = async (value) => {
    options = value;
    return {
      id: 'forwarder-1',
      port: 43121,
      stats: () => ({
        activeConnections: 0,
        totalConnections: 0,
        failedStreams: 0,
        bytesUp: 0,
        bytesDown: 0,
        activeDownMs: 0,
      }),
      stop: async () => {
        stopped = true;
      },
      isStopped: () => stopped,
    };
  };
  const endpoint = new ReactNativeIrohEndpoint({ bridge });
  await endpoint.start({ signal: new AbortController().signal });
  const candidate = { id: 'peer', kind: 'iroh', address: 'https://relay.example' };
  const forwarder = await endpoint.startTcpForwarder(candidate);
  assert.equal(forwarder.port, 43121);
  assert.deepEqual(options, {
    target: {
      kind: 'endpoint-address',
      nodeId: 'peer',
      relayUrl: 'https://relay.example',
    },
    alpn: 'sovereign-apps/1',
    listenPort: 0,
    preamble: NATIVE_TCP_STREAM_PREAMBLE,
  });
  await endpoint.stop();
  assert.equal(stopped, true);
});

test('bridge 0.2 keeps framed pairing available but reports TCP forwarding as unsupported', async () => {
  const endpoint = new ReactNativeIrohEndpoint({ bridge: fakeBridge() });
  await endpoint.start({ signal: new AbortController().signal });
  await assert.rejects(
    () =>
      endpoint.startTcpForwarder({ id: 'peer', kind: 'iroh', address: 'https://relay.example' }),
    /requires @gordo-labs\/react-native-iroh 0.3/,
  );
  await endpoint.stop();
});
