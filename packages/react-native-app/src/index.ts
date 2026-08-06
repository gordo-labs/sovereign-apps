/**
 * Sovereign App Template — React Native entry point.
 *
 * Minimal RN app that opens an Iroh endpoint, dials a peer Electron node,
 * exchanges framed JSON messages over QUIC streams.
 *
 * Uses @gordo-labs/react-native-iroh for the native Iroh bridge.
 * Falls back to a stub when the native module isn't available (dev/testing).
 */

import type { IrohBridge } from './iroh-bridge.js';

let bridge: IrohBridge | null = null;
let peerNodeId: string | null = null;
let messageLog: string[] = [];

export async function startSovereignPeer(nodeId: string): Promise<void> {
  peerNodeId = nodeId;
  const { getIrohBridge } = await import('./iroh-bridge.js');
  bridge = getIrohBridge();

  try {
    await bridge.startEndpoint();
    const myNodeId = bridge.getNodeId();
    console.log('[sovereign-rn] Node id:', myNodeId);

    // Dial the peer
    const session = await bridge.dial(nodeId);
    console.log('[sovereign-rn] Connected to:', nodeId);

    // Send hello
    const hello = JSON.stringify({
      type: 'hello',
      timestamp: new Date().toISOString(),
      from: myNodeId,
      payload: { message: 'mobile sovereign peer connected' },
    });
    await session.send(new TextEncoder().encode(hello));

    // Listen for messages
    session.onMessage((data: Uint8Array) => {
      const text = new TextDecoder().decode(data);
      console.log('[sovereign-rn] Received:', text);
      messageLog.push(text);
    });

    session.onClose(() => {
      console.log('[sovereign-rn] Disconnected');
      bridge?.stopEndpoint();
    });
  } catch (err) {
    console.error('[sovereign-rn] Error:', err);
    bridge?.stopEndpoint();
  }
}

export function getMessageLog(): string[] {
  return messageLog;
}

export function getNodeId(): string | null {
  return bridge?.getNodeId() ?? null;
}
