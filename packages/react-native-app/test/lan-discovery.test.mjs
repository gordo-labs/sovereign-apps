import test from 'node:test';
import assert from 'node:assert/strict';
import { ReactNativeLanDiscovery } from '../dist/lan-discovery.js';

function fakeBrowser() {
  const listeners = new Map();
  return {
    scans: [], stopped: 0,
    scan(type, domain) { this.scans.push({ type, domain }); },
    stop() { this.stopped++; },
    on(event, listener) { listeners.set(event, listener); return () => listeners.delete(event); },
    emit(event, value) { listeners.get(event)?.(value); },
  };
}

const service = { txt: { v: '1', app: 'demo', node: 'node-a', addrs: '["192.168.1.2:42424"]', name: 'Demo' } };

test('RN browser requests permission, deduplicates and emits candidate', async () => {
  const browser = fakeBrowser();
  const discovery = new ReactNativeLanDiscovery({ browser, requestPermission: async () => 'granted' });
  await discovery.start({ signal: new AbortController().signal, platform: 'ios', now: Date.now });
  assert.equal(browser.scans.length, 1);
  browser.emit('resolved', service);
  const iterator = discovery.discover({ timeoutMs: 20 });
  assert.equal((await iterator.next()).value.id, 'node-a');
  await discovery.stop();
  assert.equal(browser.stopped, 1);
});

test('RN browser exposes denied permission as explicit failure', async () => {
  const browser = fakeBrowser();
  const discovery = new ReactNativeLanDiscovery({ browser, requestPermission: async () => 'denied' });
  await assert.rejects(discovery.start({ signal: new AbortController().signal, platform: 'android', now: Date.now }), /LAN_PERMISSION_DENIED/);
});
