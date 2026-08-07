import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WebPresenceCore,
  MemoryPresenceStore,
  MemoryRateLimiter,
  PresenceError,
} from '../dist/index.js';
import { createNextWebPresenceRoutes } from '../dist/next.js';

const clock = {
  value: 1_700_000_000_000,
  now() {
    return this.value;
  },
};
const codec = {
  verify(value, { nowMs }) {
    const r = value;
    if (r.signature !== 'ok') throw new PresenceError('bad_signature', 400);
    return {
      identity: r.identity,
      issuedAtMs: Date.parse(r.issuedAt),
      expiresAtMs: Date.parse(r.expiresAt),
      candidateCount: r.candidates?.length ?? 0,
    };
  },
};
function setup(extra = {}) {
  return new WebPresenceCore({
    presence: new MemoryPresenceStore(),
    codec,
    rateLimiter: new MemoryRateLimiter(),
    clock,
    limits: { maxClockSkewMs: 0, ...extra },
  });
}
const record = (extra = {}) => ({
  identity: 'peer-a',
  issuedAt: new Date(clock.value).toISOString(),
  expiresAt: new Date(clock.value + 60_000).toISOString(),
  signature: 'ok',
  ...extra,
});

test(
  'accepts valid records and rejects replay/tampering/stale/oversized candidates',
  { concurrency: false },
  async () => {
    const core = setup();
    await core.putPresence(record());
    assert.deepEqual(await core.getPresence('peer-a'), record());
    await assert.rejects(() => core.putPresence(record()), { reason: 'replay' });
    await assert.rejects(() => core.putPresence(record({ signature: 'bad' })), {
      reason: 'bad_signature',
    });
    clock.value += 61_000;
    await assert.rejects(
      () =>
        core.putPresence({
          ...record(),
          issuedAt: new Date(clock.value - 120_000).toISOString(),
          expiresAt: new Date(clock.value - 60_000).toISOString(),
        }),
      { reason: 'stale' },
    );
    clock.value = 1_700_000_000_000;
    await assert.rejects(
      () => core.putPresence(record({ candidates: Array.from({ length: 17 }, () => ({})) })),
      { reason: 'too_many_candidates' },
    );
    await assert.rejects(() => core.putPresence(record({ nested: { token: 'secret' } })), {
      reason: 'forbidden_metadata',
    });
  },
);

test('atomic store accepts only one concurrent record for the same issued timestamp', async () => {
  clock.value = 1_700_000_000_000;
  const state = new Map();
  const durable = {
    get: (id) => state.get(id)?.record,
    deleteExpired: () => 0,
    putIfNewer(id, value, issuedAtMs, expiresAtMs) {
      const previous = state.get(id);
      if (previous && issuedAtMs <= previous.issuedAtMs) return false;
      state.set(id, { record: value, issuedAtMs, expiresAtMs });
      return true;
    },
  };
  const core = new WebPresenceCore({
    presence: durable,
    codec,
    rateLimiter: new MemoryRateLimiter(),
    clock,
    limits: { putPerIdentityPerWindow: 100 },
  });
  const results = await Promise.allSettled([
    core.putPresence(record()),
    core.putPresence(record()),
  ]);
  assert.equal(results.filter((x) => x.status === 'fulfilled').length, 1);
  assert.equal(
    results.filter((x) => x.status === 'rejected' && x.reason.reason === 'replay').length,
    1,
  );
});

test('enforces signaling session cap and uses the injected clock for expiry', async () => {
  clock.value = 1_700_000_000_000;
  const signaling = new (await import('../dist/memory.js')).MemorySignalingStore();
  const signalingCodec = {
    ...codec,
    verifySignaling(value, { nowMs }) {
      return {
        identity: value.identity,
        sessionId: value.sessionId,
        issuedAtMs: nowMs,
        expiresAtMs: nowMs + 60_000,
      };
    },
  };
  const core = new WebPresenceCore({
    presence: new MemoryPresenceStore(),
    signaling,
    codec: signalingCodec,
    rateLimiter: new MemoryRateLimiter(),
    clock,
    limits: { maxSignalingPerSession: 1, signalingPerSessionPerWindow: 100 },
  });
  await core.putSignaling(
    { identity: 'peer-a', sessionId: 'session-a' },
    undefined,
    'peer-a',
    'session-a',
  );
  await assert.rejects(
    () =>
      core.putSignaling(
        { identity: 'peer-a', sessionId: 'session-a' },
        undefined,
        'peer-a',
        'session-a',
      ),
    { reason: 'signaling_session_full' },
  );
  clock.value += 120_000;
  assert.deepEqual(await core.getSignaling('peer-a', 'session-a'), []);
});

test(
  'rate limits and keeps anonymous presence non-authoritative',
  { concurrency: false },
  async () => {
    clock.value = 1_700_000_000_000;
    const core = setup({ putPerIdentityPerWindow: 1 });
    const request = new Request('https://example.test', {
      headers: { origin: 'https://example.test' },
    });
    await core.putPresence(record(), request);
    await assert.rejects(
      () =>
        core.putPresence(
          { ...record(), issuedAt: new Date(clock.value + 1).toISOString() },
          request,
        ),
      { reason: 'rate_limited' },
    );
  },
);

test('Next route factories preserve arbitrary mount path and App Router contract', async () => {
  clock.value = 1_700_000_000_000;
  const routes = createNextWebPresenceRoutes({
    core: setup(),
    basePath: 'api/presence/',
    apiBase: 'https://presence.example/api/presence',
  });
  assert.equal(routes.basePath, '/api/presence');
  const bootstrap = await routes.bootstrap(
    new Request('https://presence.example/api/presence/bootstrap'),
    { params: Promise.resolve({}) },
  );
  assert.equal(bootstrap.status, 200);
  const put = await routes.presence(
    new Request('https://presence.example/api/presence/peer-a', {
      method: 'PUT',
      body: JSON.stringify({ record: record() }),
      headers: { 'content-type': 'application/json' },
    }),
    { params: Promise.resolve({ identity: 'peer-a' }) },
  );
  assert.equal(put.status, 204);
  const get = await routes.presence(new Request('https://presence.example/api/presence/peer-a'), {
    params: Promise.resolve({ identity: 'peer-a' }),
  });
  assert.equal(get.status, 200);
  const mismatch = await routes.presence(
    new Request('https://presence.example/api/presence/peer-b', {
      method: 'PUT',
      body: JSON.stringify({ record: record() }),
      headers: { 'content-type': 'application/json' },
    }),
    { params: Promise.resolve({ identity: 'peer-b' }) },
  );
  assert.equal(mismatch.status, 400);
  const invalidSince = await routes.signaling(
    new Request('https://presence.example/api/presence/peer-a/session-a?since=not-a-date'),
    { params: Promise.resolve({ identity: 'peer-a', sessionId: 'session-a' }) },
  );
  assert.equal(invalidSince.status, 400);
  const invalidIdentity = await routes.presence(new Request('https://presence.example'), {
    params: Promise.resolve({ identity: 'x'.repeat(513) }),
  });
  assert.equal(invalidIdentity.status, 400);
});
