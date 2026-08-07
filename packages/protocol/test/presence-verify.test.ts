import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalJson, verifyPresenceRecord } from '../dist/index.js';

const now = Date.parse('2026-08-06T12:00:00.000Z');
const base = {
  schemaVersion: 1,
  hubId: 'hub',
  transportPeerId: 'peer',
  issuedAt: '2026-08-06T11:59:30.000Z',
  expiresAt: '2026-08-06T12:00:30.000Z',
  signature: 'abcdefghijklmnop',
};

test('presence verifier validates signed canonical payload and replay ordering', async () => {
  let seen = '';
  const result = await verifyPresenceRecord(
    base,
    'trusted-key',
    async (payload, signature, key) => {
      seen = `${new TextDecoder().decode(payload)}:${signature}:${key}`;
      return (
        canonicalJson({ ...base, signature: undefined }).includes('hub') &&
        signature === base.signature
      );
    },
    { now },
  );
  assert.equal(result.ok, true);
  assert.match(seen, /hub/);

  const replay = await verifyPresenceRecord(base, 'trusted-key', () => true, {
    now,
    lastAcceptedIssuedAt: base.issuedAt,
  });
  assert.equal(replay.ok, false);
  if (!replay.ok) assert.equal(replay.code, 'replay');
});

test('presence verifier rejects expired, future and forbidden records before signature work', async () => {
  let calls = 0;
  const verify = async () => {
    calls += 1;
    return true;
  };
  const expired = await verifyPresenceRecord(
    { ...base, expiresAt: '2026-08-06T11:59:59.000Z' },
    'key',
    verify,
    { now },
  );
  assert.equal(expired.ok, false);
  const future = await verifyPresenceRecord(
    { ...base, issuedAt: '2026-08-06T12:01:00.000Z' },
    'key',
    verify,
    { now },
  );
  assert.equal(future.ok, false);
  const forbidden = await verifyPresenceRecord({ ...base, trackId: 'secret' }, 'key', verify, {
    now,
  });
  assert.equal(forbidden.ok, false);
  assert.equal(calls, 0);
});
