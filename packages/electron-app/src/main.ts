import { app, BrowserWindow } from 'electron';
import { createServer } from 'node:http';
import { createPairingWindow, type PairingUiHandle } from './pairing-ui.js';
import { createIrohNode, type IrohNode } from './iroh-node.js';
import { loadOrCreateIdentities } from './node-key.js';
import { DesktopPairingAuthority } from './secure-pairing.js';
import { forwardNativeTcpStream } from './native-tcp-forwarder.js';
import { DEFAULT_ALPN, HubPairing } from '@sovereign-apps/protocol';

export type ElectronRuntime = {
  node: IrohNode;
  window: BrowserWindow;
  pairing: PairingUiHandle;
  stop(): Promise<void>;
};

let runtime: ElectronRuntime | null = null;

export async function startElectronRuntime(): Promise<ElectronRuntime> {
  if (runtime) return runtime;
  await app.whenReady();
  const identities = loadOrCreateIdentities({ dataDir: app.getPath('userData') });
  const localService = createServer((request, response) => {
    if (request.method === 'GET' && request.url === '/health') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ status: 'ok', service: 'sovereign-app-example' }));
      return;
    }
    response.writeHead(404, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ error: 'not_found' }));
  });
  await new Promise<void>((resolve, reject) => {
    localService.once('error', reject);
    localService.listen(0, '127.0.0.1', () => {
      localService.off('error', reject);
      resolve();
    });
  });
  const localServiceAddress = localService.address();
  if (!localServiceAddress || typeof localServiceAddress === 'string')
    throw new Error('Could not bind the local example service');
  const node = await createIrohNode({ key: identities.iroh.bytes });
  const pairingAuthority = new DesktopPairingAuthority();
  const dialAddresses = node.candidates.flatMap((candidate) => {
    if (candidate.kind === 'relay') return [candidate.address];
    try {
      const parsed = JSON.parse(candidate.address) as { addrs?: unknown };
      return Array.isArray(parsed.addrs)
        ? parsed.addrs.filter((item): item is string => typeof item === 'string')
        : [];
    } catch {
      return [];
    }
  });
  const bootstrap = dialAddresses.length
    ? JSON.stringify({ id: node.nodeId, addrs: dialAddresses })
    : undefined;
  const pairingQr = pairingAuthority.createQr({
    hubId: 'sovereign-app',
    nodeId: node.nodeId,
    desktopPublicKey: node.nodeId,
    alpn: DEFAULT_ALPN,
    bootstrap,
  });
  void node.serveSessions(async (connection) => {
    let handled = false;
    connection.onMessage((data) => {
      if (handled) return;
      handled = true;
      void (async () => {
        try {
          const message = JSON.parse(new TextDecoder().decode(data)) as {
            type?: unknown;
            sessionRef?: unknown;
            mobileNodeId?: unknown;
          };
          if (
            message.type !== 'sovereign.pair.request' ||
            typeof message.sessionRef !== 'string' ||
            typeof message.mobileNodeId !== 'string' ||
            message.mobileNodeId !== connection.peerId
          )
            throw new Error('Pairing request does not match the authenticated Iroh peer');
          const grant = pairingAuthority.completeScannedPairing(
            message.sessionRef,
            connection.peerId,
          );
          await connection.send(
            new TextEncoder().encode(JSON.stringify({ type: 'sovereign.pair.grant', grant })),
          );
          const stopForwarding = connection.onExtraStream((stream) =>
            forwardNativeTcpStream(stream, { port: localServiceAddress.port }),
          );
          connection.onClose(stopForwarding);
          pairing.appendLog(`Paired mobile peer ${connection.peerId.slice(0, 16)}…`);
          pairing.onPaired(connection.peerId, grant.capabilities);
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error);
          await connection
            .send(
              new TextEncoder().encode(JSON.stringify({ type: 'sovereign.pair.reject', reason })),
            )
            .catch(() => undefined);
          pairing.appendLog(`Pairing rejected: ${reason}`);
        }
      })();
    });
    connection.onClose(() => undefined);
  });
  const pairing = await createPairingWindow({
    nodeId: node.nodeId,
    peerId: 'Sovereign App',
    qrPayload: pairingQr.envelope,
    fingerprint: HubPairing.fingerprint(node.nodeId),
    advertisePort: 0,
  });
  const window = pairing.window;
  const stop = async () => {
    if (!runtime) return;
    runtime = null;
    if (!window.isDestroyed()) window.close();
    await new Promise<void>((resolve) => localService.close(() => resolve()));
    await node.close();
  };
  runtime = { node, window, pairing, stop };
  return runtime;
}

export async function stopElectronRuntime(): Promise<void> {
  await runtime?.stop();
}

if (process.versions.electron) {
  app
    .whenReady()
    .then(() => startElectronRuntime())
    .catch((error) => {
      console.error('[sovereign-app] startup failed:', error);
      app.quit();
    });
  app.on('activate', () => {
    void startElectronRuntime();
  });
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
  app.on('before-quit', () => {
    void stopElectronRuntime();
  });
}
