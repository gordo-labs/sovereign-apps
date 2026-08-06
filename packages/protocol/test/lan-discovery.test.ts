import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeLanTxt, lanRecordToCandidate, parseLanTxt } from '../dist/index.js';

const record = { version: 1 as const, appId: 'demo', nodeId: 'node-a', directAddrs: ['192.168.1.2:42424', '[fe80::1]:42424'], sessionRef: 'ephemeral', displayName: 'Demo' };

test('LAN TXT round-trips and unknown keys are ignored', () => {
  const parsed = parseLanTxt({ ...encodeLanTxt(record), unknown: 'spoofed' });
  assert.deepEqual(parsed, record);
  assert.equal(lanRecordToCandidate(parsed!).transport, 'iroh.lan');
});

test('LAN TXT rejects wrong version, malformed addresses and oversized fields', () => {
  assert.equal(parseLanTxt({ ...encodeLanTxt(record), v: '2' }), null);
  assert.equal(parseLanTxt({ ...encodeLanTxt(record), addrs: JSON.stringify(['http://evil']) }), null);
  assert.equal(parseLanTxt({ ...encodeLanTxt(record), name: 'x'.repeat(97) }), null);
});
