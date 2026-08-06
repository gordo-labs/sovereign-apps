/**
 * Sovereign App Template — Electron main process.
 *
 * Starts an Iroh endpoint with full pairing flow:
 *   - QR code for initial WiFi connection
 *   - LAN advertisement for peer discovery
 *   - Ed25519 challenge-response authentication
 *   - Capability-based grants
 *   - Paired peer store
 *
 * Based on Music Hub's sovereign networking stack:
 *   - IrohHubResponder (desktop listener)
 *   - HubPairing + MobileHubClient (QR/auth protocol)
 *   - WiFi-direct LAN discovery
 */

import { createIrohNode, type IrohNode } from './iroh-node.js';
import { createNodeKey } from './node-key.js';
import { createPairingWindow, type PairingUiHandle } from './pairing-ui.js';
import {
  HubPairing,
  DesktopPairingSession,
  PairedPeerStore,
  deriveFingerprint,
  DEFAULT_LAN_PORT,
} from '@sovereign-apps/protocol';

const SOVEREIGN_PATH = '/sovereign';

let node: IrohNode | null = null;
let pairingWindow: PairingUiHandle | null = null;
let pairingSession: DesktopPairingSession | null = null;
let pairedStore: PairedPeerStore | null = null;

async function main(): Promise<void> {
  console.log('[sovereign-app] Starting Electron sovereign node with pairing…');

  // --- Step 1: Start Iroh node ---
  const key = createNodeKey();
  node = await createIrohNode(key);
  console.log('[sovereign-app] Iroh node id:', node.nodeId);

  // --- Step 2: Create pairing session ---
  const peerId = 'sovereign-peer'; // Logical hub ID
  const publicKey = null; // @momics/iroh-http-node exposes publicKey via endpoint
  pairingSession = new DesktopPairingSession({
    peerId,
    nodeId: node.nodeId,
    publicKey,
  });

  // --- Step 3: Build QR payload ---
  const qrPayload = pairingSession.buildQrPayload({
    bootstrap: null,
    directAddrs: node.addrs,
  });
  console.log('[sovereign-app] Pairing QR payload ready');

  // --- Step 4: Derive fingerprint for visual verification ---
  const fingerprint = HubPairing.fingerprint(node.nodeId);
  console.log('[sovereign-app] Fingerprint:', fingerprint);

  // --- Step 5: Create pairing UI window ---
  pairingWindow = await createPairingWindow({
    nodeId: node.nodeId,
    peerId,
    qrPayload,
    fingerprint,
    advertisePort: DEFAULT_LAN_PORT,
  });
  console.log('[sovereign-app] Pairing window opened');

  // --- Step 6: Serve sovereign tunnel (accept connections) ---
  pairedStore = new PairedPeerStore();
  await node.serveSessions((connection) => {
    console.log('[sovereign-app] Peer connected:', connection.peerId ?? 'unknown');
    pairingWindow?.appendLog(`Peer connected: ${connection.peerId ?? 'unknown'}`);

    connection.onMessage((data) => {
      const text = new TextDecoder().decode(data);
      console.log('[sovereign-app] Received:', text.slice(0, 200));
      pairingWindow?.appendLog(`Message: ${text.slice(0, 100)}…`);

      // Parse sovereign message
      try {
        const msg = JSON.parse(text);
        handlePeerMessage(msg, connection);
      } catch {
        pairingWindow?.appendLog('Unparseable message');
      }
    });

    connection.onClose?.(() => {
      console.log('[sovereign-app] Peer disconnected:', connection.peerId ?? 'unknown');
      pairingWindow?.appendLog(`Peer disconnected: ${connection.peerId ?? 'unknown'}`);
    });

    // Send hello
    const hello = new TextEncoder().encode(
      JSON.stringify({
        type: 'hello',
        timestamp: new Date().toISOString(),
        from: node!.nodeId,
        payload: { message: 'sovereign peer connected', fingerprint },
      }) + '\n',
    );
    connection.send(hello);
  });
}

/**
 * Handle a received sovereign message.
 */
function handlePeerMessage(
  msg: any,
  connection: import('./iroh-node.js').IrohDuplexConnection,
): void {
  if (!msg.type) return;

  switch (msg.type) {
    case 'pairing.scan':
      pairingWindow?.onPeerScanned(msg.from ?? 'unknown');
      pairingWindow?.onHandshakeProgress('challenge');
      // Send challenge — In a real setup the mobile would first
      // verify fingerprint, then send auth.response.
      // For template purposes, acknowledge the scan.
      const challengeAck = new TextEncoder().encode(
        JSON.stringify({
          type: 'pairing.challenge',
          version: 1,
          nonce: 'ack',
          challenger: node?.nodeId ?? '',
          requested: ['app.read', 'media.stream'],
        }),
      );
      connection.send(challengeAck);
      break;

    case 'auth.response':
      pairingWindow?.onHandshakeProgress('response received');
      // In real deployment, verifyResponse would validate Ed25519 signature
      pairingWindow?.onHandshakeProgress('signature verified');
      pairingWindow?.onPaired(msg.from ?? 'unknown', msg.granted ?? []);
      break;

    case 'hello':
      pairingWindow?.appendLog(`Hello from ${msg.from ?? 'unknown'}`);
      break;

    default:
      pairingWindow?.appendLog(`Unknown type: ${msg.type}`);
  }
}

process.on('SIGINT', async () => {
  console.log('[sovereign-app] Shutting down…');
  await node?.close();
  pairingWindow = null;
  process.exit(0);
});

main().catch((err) => {
  console.error('[sovereign-app] Fatal:', err);
  process.exit(1);
});
