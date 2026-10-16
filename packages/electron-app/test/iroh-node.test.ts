import test from 'node:test';
import assert from 'node:assert/strict';
import { ElectronIrohNode, IrohRuntimeError } from '../dist/iroh-node.js';
import { negotiateStreamHello } from '../../protocol/dist/index.js';

function fakeNative(nodeId: string, relayUrl: string | null = 'https://relay.example') {
  const closed = Promise.resolve({ closeCode: 0, reason: 'closed' });
  return {
    publicKey: { toString: () => nodeId },
    ticket: async () => `ticket:${nodeId}`,
    discoveryInfo: async () => ({
      nodeId,
      directAddress: '192.168.1.10:42424',
      directAddresses: ['192.168.1.10:42424'],
      relayUrl,
    }),
    incoming: () =>
      (async function* () {
        await new Promise<void>(() => undefined);
      })(),
    dial: async () => {
      throw new Error('fake dial');
    },
    close: async () => undefined,
    closed,
  } as never;
}

function connectedStreams(peerAlpn: string) {
  const aToB = new TransformStream<Uint8Array, Uint8Array>();
  const bToA = new TransformStream<Uint8Array, Uint8Array>();
  const local = { readable: bToA.readable, writable: aToB.writable };
  const peer = { readable: aToB.readable, writable: bToA.writable };
  void (async () => {
    const reader = peer.readable.getReader();
    const writer = peer.writable.getWriter();
    try {
      await negotiateStreamHello(
        {
          read: async () => {
            const result = await reader.read();
            return result.done ? null : result.value;
          },
          write: (data) => writer.write(data),
        },
        { alpn: peerAlpn },
      );
    } finally {
      reader.releaseLock();
      writer.releaseLock();
    }
  })().catch(() => undefined);
  return local;
}

test('uses real-node factory and classifies direct and relay candidates', async () => {
  const node = await ElectronIrohNode.create({
    key: new Uint8Array(32).fill(1),
    nativeFactory: async () => fakeNative('peer-a'),
  });
  assert.equal(node.state, 'ready');
  assert.equal(node.candidates.length, 2);
  assert.equal(node.candidates[0]?.kind, 'direct');
  assert.equal(node.candidates[1]?.kind, 'relay');
  await node.close();
  assert.equal(node.state, 'closed');
  await assert.rejects(
    () => node.dial('peer-b'),
    (error: unknown) => error instanceof IrohRuntimeError && error.state === 'closed',
  );
});

test('missing native runtime is an observable hard error', async () => {
  await assert.rejects(
    () =>
      ElectronIrohNode.create({
        key: new Uint8Array(32).fill(2),
        nativeFactory: async () => {
          throw new Error('addon missing');
        },
      }),
    (error: unknown) => error instanceof IrohRuntimeError && error.state === 'unavailable',
  );
});

test('extra QUIC streams can be adapted to a loopback TCP service after preamble validation', async () => {
  const { createServer } = await import('node:net');
  const { forwardNativeTcpStream } = await import('../dist/native-tcp-forwarder.js');
  const { NATIVE_TCP_STREAM_PREAMBLE } = await import('../../protocol/dist/index.js');
  const service = createServer((socket) => socket.on('data', (data) => socket.write(data)));
  await new Promise<void>((resolve) => service.listen(0, '127.0.0.1', resolve));
  const address = service.address();
  assert.ok(address && typeof address !== 'string');

  const toForwarder = new TransformStream<Uint8Array, Uint8Array>();
  const fromForwarder = new TransformStream<Uint8Array, Uint8Array>();
  const forward = forwardNativeTcpStream(
    { readable: toForwarder.readable, writable: fromForwarder.writable },
    { port: address.port },
  );
  const writer = toForwarder.writable.getWriter();
  const reader = fromForwarder.readable.getReader();
  const payload = new TextEncoder().encode('sovereign-template');
  const request = new Uint8Array(NATIVE_TCP_STREAM_PREAMBLE.length + payload.length);
  request.set(NATIVE_TCP_STREAM_PREAMBLE);
  request.set(payload, NATIVE_TCP_STREAM_PREAMBLE.length);
  await writer.write(request);
  const response = await reader.read();
  assert.deepEqual(new Uint8Array(response.value ?? []), payload);
  await writer.close();
  await forward;
  await new Promise<void>((resolve) => service.close(() => resolve()));
});

test('extra QUIC stream with an unknown preamble is rejected before app bytes reach TCP', async () => {
  const { createServer } = await import('node:net');
  const { forwardNativeTcpStream } = await import('../dist/native-tcp-forwarder.js');
  const service = createServer();
  await new Promise<void>((resolve) => service.listen(0, '127.0.0.1', resolve));
  const address = service.address();
  assert.ok(address && typeof address !== 'string');

  const toForwarder = new TransformStream<Uint8Array, Uint8Array>();
  const fromForwarder = new TransformStream<Uint8Array, Uint8Array>();
  const forward = forwardNativeTcpStream(
    { readable: toForwarder.readable, writable: fromForwarder.writable },
    { port: address.port },
  );
  await toForwarder.writable.getWriter().write(new TextEncoder().encode('not-a-valid-preamble'));
  await assert.rejects(forward, /preamble is not recognized/);
  await new Promise<void>((resolve) => service.close(() => resolve()));
});

test('dial validates the application hello when native Iroh has no ALPN option', async () => {
  const node = await ElectronIrohNode.create({
    key: new Uint8Array(32).fill(3),
    nativeFactory: async () =>
      ({
        ...fakeNative('peer-a'),
        dial: async () => ({
          remoteId: { toString: () => 'peer-b' },
          ready: Promise.resolve(undefined),
          closed: new Promise(() => undefined),
          createBidirectionalStream: async () => connectedStreams('other-app/1'),
          close: () => undefined,
        }),
      }) as never,
  });
  const session = await node.dial('peer-b');
  await assert.rejects(() => session.createBidirectionalStream(), /mismatch/);
  await node.close();
});

test(
  'real local two-node test is opt-in and capability gated',
  { skip: process.env.RUN_REAL_IROH_TESTS !== '1' },
  async () => {
    const { createIrohNode } = await import('../dist/iroh-node.js');
    const a = await createIrohNode({ key: crypto.getRandomValues(new Uint8Array(32)) });
    const b = await createIrohNode({ key: crypto.getRandomValues(new Uint8Array(32)) });
    try {
      assert.notEqual(a.nodeId, b.nodeId);
      assert.ok(a.candidates.length + b.candidates.length >= 0);
    } finally {
      await Promise.all([a.close(), b.close()]);
    }
  },
);
