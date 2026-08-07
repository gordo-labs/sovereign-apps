import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeStreamHello, encodeStreamHello, negotiateStreamHello } from '../dist/index.js';

function queuePair(split = false) {
  type Waiter = (value: Uint8Array | null) => void;
  const queues: Uint8Array[][] = [[], []];
  const waiters: Array<Waiter[]> = [[], []];
  const endpoint = (side: 0 | 1) => ({
    async write(data: Uint8Array): Promise<void> {
      const target = side === 0 ? 1 : 0;
      const chunks = split ? [data.slice(0, 2), data.slice(2)] : [new Uint8Array(data)];
      for (const chunk of chunks) {
        const waiter = waiters[target].shift();
        if (waiter) waiter(chunk);
        else queues[target].push(chunk);
      }
    },
    async read(): Promise<Uint8Array | null> {
      const queued = queues[side].shift();
      if (queued) return queued;
      return new Promise((resolve) => waiters[side].push(resolve));
    },
  });
  return [endpoint(0), endpoint(1)] as const;
}

test('stream hello negotiates the expected version and ALPN across fragmented reads', async () => {
  const [a, b] = queuePair(true);
  await Promise.all([
    negotiateStreamHello(a, { alpn: 'sovereign-apps/1' }),
    negotiateStreamHello(b, { alpn: 'sovereign-apps/1' }),
  ]);
});

test('stream hello rejects an ALPN mismatch before application data is exposed', async () => {
  const [a, b] = queuePair();
  const results = await Promise.allSettled([
    negotiateStreamHello(a, { alpn: 'sovereign-apps/1' }),
    negotiateStreamHello(b, { alpn: 'other-app/1' }),
  ]);
  assert.equal(results[0]?.status, 'rejected');
  assert.equal(results[1]?.status, 'rejected');
  assert.match(String((results[0] as PromiseRejectedResult).reason), /mismatch/);
  assert.match(String((results[1] as PromiseRejectedResult).reason), /mismatch/);
});

test('stream hello validates its magic, version and bounded domain', () => {
  const encoded = encodeStreamHello('sovereign-apps/1');
  const payload = encoded.slice(4);
  assert.deepEqual(decodeStreamHello(payload), { version: 1, alpn: 'sovereign-apps/1' });
  assert.throws(
    () => decodeStreamHello(Uint8Array.of(...payload.slice(0, -1))),
    /length|truncated/,
  );
});

test('stream hello timeout does not wait forever on a backpressured write', async () => {
  await assert.rejects(
    () =>
      negotiateStreamHello(
        {
          write: () => new Promise<void>(() => undefined),
          read: () => new Promise<Uint8Array | null>(() => undefined),
        },
        { alpn: 'sovereign-apps/1', timeoutMs: 10 },
      ),
    /timed out/,
  );
});
