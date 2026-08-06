import test from 'node:test';
import assert from 'node:assert/strict';
import { fragmentBootstrap, decodeFragment, reassembleBootstrap, ReassemblySession } from '../dist/fragmentation.js';
import { createFakeBlePair } from '../dist/adapters.js';
import { BleBootstrapSession, receiveBootstrap } from '../dist/service.js';

test('fragments and reassembles out of order with duplicate', async () => {
  const input = new TextEncoder().encode('bootstrap envelope');
  const fragments = await fragmentBootstrap(input, { mtu: 23, transferId: new Uint8Array([1,2,3,4,5,6,7,8]) });
  const result = await reassembleBootstrap([...fragments].reverse().concat(fragments[0]));
  assert.deepEqual(result, input);
});

test('rejects tampering, conflicting duplicate and incomplete data', async () => {
  const fragments = await fragmentBootstrap(new Uint8Array(100), { mtu: 23, transferId: new Uint8Array([1,2,3,4,5,6,7,8]) });
  const tampered = new Uint8Array(fragments[0].wire); tampered[tampered.length - 1] ^= 1;
  await assert.rejects(() => reassembleBootstrap([tampered, ...fragments.slice(1)]), /integrity|duplicate|different|incomplete/);
  await assert.rejects(() => reassembleBootstrap(fragments.slice(0, -1)), /incomplete/);
  const conflicting = new Uint8Array(fragments[0].wire); conflicting[conflicting.length - 1] ^= 1;
  await assert.rejects(() => reassembleBootstrap([fragments[0], conflicting, ...fragments.slice(1)]), /Conflicting duplicate/);
});

test('enforces size, sequence and timeout/cancellation', async () => {
  await assert.rejects(() => fragmentBootstrap(new Uint8Array(8193)), /exceeds/);
  const fragments = await fragmentBootstrap(new Uint8Array([1, 2]), { transferId: new Uint8Array([1,2,3,4,5,6,7,8]) });
  const bad = new Uint8Array(fragments[0].wire); bad[14] = 1;
  assert.throws(() => decodeFragment(bad), /sequence/);
  let now = 0;
  const session = new ReassemblySession(10, () => now);
  session.push(fragments[0]); now = 11;
  assert.throws(() => session.push(fragments[0]), /timed out/);
  const cancelled = new ReassemblySession(); cancelled.cancel(); assert.throws(() => cancelled.push(fragments[0]), /cancelled/);
});

test('fake central/peripheral transfers bootstrap and cleans up', async () => {
  const { central, peripheral, advertisement } = createFakeBlePair({ mtu: 23 });
  const peripheralConnection = await peripheral.connect(advertisement);
  const receiving = receiveBootstrap(peripheralConnection, { timeoutMs: 500 });
  const payload = new TextEncoder().encode('authenticated bootstrap envelope');
  const sender = new BleBootstrapSession(central);
  assert.deepEqual(await sender.transfer(advertisement, payload, { mtu: 23, transferId: new Uint8Array([8,7,6,5,4,3,2,1]) }), payload);
  assert.deepEqual(await receiving, payload);
  await peripheralConnection.close();
});
