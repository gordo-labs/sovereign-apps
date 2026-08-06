/**
 * Legacy Electron message viewer window.
 * Kept for backward compatibility — main.ts now uses createPairingWindow.
 */

import { BrowserWindow, app } from 'electron';

export async function createElectronWindow(nodeId: string) {
  await app.whenReady();

  const win = new BrowserWindow({
    width: 600,
    height: 400,
    title: `Sovereign App — ${nodeId.slice(0, 12)}...`,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: undefined,
    },
  });

  const html = `<!DOCTYPE html>
<html>
<body style="font-family:monospace;padding:16px">
<h2>Sovereign App</h2>
<p>Node ID: <code id="nodeId">${nodeId}</code></p>
<p>Status: <span id="status">listening</span></p>
<h3>Messages:</h3>
<pre id="log" style="background:#f5f5f5;padding:8px;border:1px solid #ccc;min-height:100px"><em>waiting for connections...</em></pre>
<script>
const nodeId = document.getElementById('nodeId');
const status = document.getElementById('status');
const log = document.getElementById('log');
window.appendMessage = function(text) {
  const line = document.createElement('div');
  line.textContent = '> ' + text.slice(0, 200);
  log.appendChild(line);
};
</script>
</body>
</html>`;

  win.loadURL(`data:text/html;base64,${Buffer.from(html).toString('base64')}`);

  return {
    appendMessage(text: string) {
      win.webContents.executeJavaScript(`appendMessage(${JSON.stringify(text)})`);
    },
    close() {
      win.close();
    },
  };
}
