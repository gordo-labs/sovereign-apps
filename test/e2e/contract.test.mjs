import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FrameDecoder,
  EnvelopeDecoder,
  PairingGrantStore,
  createEnvelope,
  decodeEnvelope,
  encodeEnvelope,
  request,
  response,
  event,
} from '../../packages/protocol/dist/index.js';

/**
 * Deterministic desktop/mobile contract fixture. It intentionally models the
 * framed byte boundary rather than importing either platform runtime. This
 * keeps every PR fast while still exercising the same envelope and grant
 * lifecycle consumed by Electron and React Native adapters.
 */
class InProcessPeer {
  constructor(name, link) {
    this.name = name;
    this.link = link;
    this.decoder = new EnvelopeDecoder(64 * 1024);
    this.connected = false;
    this.receivedEvents = [];
    this.pending = new Map();
    this.sequence = 0;
  }

  connect(access) {
    if (!this.link.grants.isAuthorized(this.link.grant.id, access)) {
      throw new Error(`${this.name}: revoked or invalid grant`);
    }
    this.connected = true;
    return () => {
      this.connected = false;
      for (const pending of this.pending.values()) pending.reject(new Error('closed'));
      this.pending.clear();
    };
  }

  receive(chunk) {
    for (const envelope of this.decoder.pushEnvelopes(chunk)) {
      if (envelope.type === 'event') this.receivedEvents.push(envelope.payload);
      if (envelope.type === 'response') {
        const pending = this.pending.get(envelope.correlationId);
        if (pending) {
          this.pending.delete(envelope.correlationId);
          pending.resolve(envelope.payload);
        }
      }
      if (envelope.type === 'request' && envelope.payload?.kind === 'ping') {
        this.link.deliver(
          this === this.link.desktop ? this.link.mobile : this.link.desktop,
          encodeEnvelope(response(envelope.correlationId, { kind: 'pong', from: this.name })),
        );
      }
    }
  }

  sendRequest(payload) {
    if (!this.connected) return Promise.reject(new Error(`${this.name}: disconnected`));
    const correlationId = `${this.name}-${++this.sequence}`;
    const frame = encodeEnvelope(request(correlationId, payload));
    return new Promise((resolve, reject) => {
      this.pending.set(correlationId, { resolve, reject });
      this.link.deliver(this === this.link.desktop ? this.link.mobile : this.link.desktop, frame);
    });
  }

  sendEvent(payload) {
    if (!this.connected) throw new Error(`${this.name}: disconnected`);
    this.link.deliver(
      this === this.link.desktop ? this.link.mobile : this.link.desktop,
      encodeEnvelope(event(`${this.name}-${++this.sequence}`, payload)),
    );
  }
}

class InProcessLink {
  constructor() {
    this.grants = new PairingGrantStore();
    this.grant = this.grants.issue({
      peerKey: 'mobile-public-key',
      nodeId: 'mobile-node',
      capabilities: ['app.read'],
    });
    this.desktop = new InProcessPeer('desktop', this);
    this.mobile = new InProcessPeer('mobile', this);
  }

  deliver(peer, frame) {
    // Deliberately split the header and payload to prove fragmentation is not
    // an implementation detail of one runtime.
    peer.receive(frame.subarray(0, 2));
    peer.receive(frame.subarray(2, 7));
    peer.receive(frame.subarray(7));
  }
}

test('desktop/mobile contract covers pair, bidirectional messages, reconnect and revoke', async () => {
  const link = new InProcessLink();
  const desktopReconnect = link.desktop.connect(link.grant.accessToken);
  const mobileReconnect = link.mobile.connect(link.grant.accessToken);

  assert.deepEqual(await link.desktop.sendRequest({ kind: 'ping', value: 'hello' }), {
    kind: 'pong',
    from: 'mobile',
  });
  link.mobile.sendEvent({ kind: 'event', value: 42 });
  assert.deepEqual(link.desktop.receivedEvents, [{ kind: 'event', value: 42 }]);

  desktopReconnect();
  mobileReconnect();
  assert.throws(() => link.desktop.sendEvent({ kind: 'offline' }), /disconnected/);

  link.desktop.connect(link.grant.accessToken);
  link.mobile.connect(link.grant.accessToken);
  assert.deepEqual(await link.mobile.sendRequest({ kind: 'ping', value: 'after-restart' }), {
    kind: 'pong',
    from: 'desktop',
  });

  link.grants.revoke(link.grant.id);
  assert.throws(() => link.desktop.connect(link.grant.accessToken), /revoked/);
  assert.throws(() => link.mobile.connect(link.grant.accessToken), /revoked/);
});

test('contract rejects malformed and over-limit traffic before dispatch', () => {
  const link = new InProcessLink();
  assert.throws(() => decodeEnvelope(new TextEncoder().encode('{"type":')));
  assert.throws(
    () => encodeEnvelope(createEnvelope('event', 'bounded', { data: 'x'.repeat(3_000_000) })),
    /Frame too large|Payload/,
  );
  const decoder = new FrameDecoder({ maxFrameBytes: 32 });
  const malformedLength = new Uint8Array([0, 0, 1, 0]);
  assert.throws(() => decoder.push(malformedLength), /Frame too large/);
  assert.equal(link.desktop.receivedEvents.length, 0);
});
