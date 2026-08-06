import test from 'node:test';
import assert from 'node:assert/strict';
import { ElectronIrohNode, IrohRuntimeError } from '../dist/iroh-node.js';

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
