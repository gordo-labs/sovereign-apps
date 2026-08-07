import { app, BrowserWindow } from 'electron';
import { createDiagnosticWindow, snapshotForNode } from './diagnostic-ui.js';
import { createIrohNode, type IrohNode } from './iroh-node.js';
import { loadOrCreateIdentities } from './node-key.js';

export type ElectronRuntime = {
  node: IrohNode;
  window: BrowserWindow;
  stop(): Promise<void>;
};

let runtime: ElectronRuntime | null = null;

export async function startElectronRuntime(): Promise<ElectronRuntime> {
  if (runtime) return runtime;
  await app.whenReady();
  const identities = loadOrCreateIdentities({ dataDir: app.getPath('userData') });
  const node = await createIrohNode({ key: identities.iroh.bytes });
  void node.serveSessions(async (connection) => {
    connection.onClose(() => undefined);
  });
  const window = await createDiagnosticWindow(snapshotForNode(node, identities.app.fingerprint));
  const stop = async () => {
    if (!runtime) return;
    runtime = null;
    if (!window.isDestroyed()) window.close();
    await node.close();
  };
  runtime = { node, window, stop };
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
