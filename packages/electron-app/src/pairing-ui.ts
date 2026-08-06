/**
 * Sovereign App Desktop — Pairing UI.
 *
 * HTML+CSS UI for the desktop Electron window that shows:
 *   - QR code for initial WiFi pairing
 *   - Fingerprint for side-channel verification
 *   - Connection status (peers, handshake progress, paired devices)
 *   - Paired peer list
 *
 * This is the screen Gordo wants: "que el desktop tenga una screen de QR
 * para establecer conexion via wifi inicial"
 */

import type { PairingQrPayload } from '@sovereign-apps/protocol';
import { qrCodeToHtml, generateQrCode } from './qr-generator.js';

import { BrowserWindow, app } from 'electron';

/** Build the complete pairing UI HTML. */
export function buildPairingHtml(params: {
  nodeId: string;
  peerId: string;
  qrPayload: PairingQrPayload;
  fingerprint: string;
  advertisePort: number;
}): string {
  const qrText = JSON.stringify(params.qrPayload);
  const qr = generateQrCode(qrText);
  const qrHtml = qrCodeToHtml(qr, 'Scan to pair');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', monospace;
    background: #1a1a1a; color: #eee; padding: 24px;
    width: 100vw; height: 100vh; overflow: auto;
  }
  .header { text-align: center; margin-bottom: 24px; }
  .header h1 { font-size: 1.4em; color: #fff; margin-bottom: 4px; }
  .header p { font-size: 0.85em; color: #888; }
  .node-id {
    font-size: 0.75em; color: #0f0;
    background: #222; padding: 6px 12px;
    border-radius: 4px; font-family: monospace;
    word-break: break-all; margin: 8px 0;
  }
  .fingerprint {
    font-size: 1.1em; font-weight: bold;
    color: #ffd700; letter-spacing: 2px;
    background: #333; padding: 8px 16px;
    border-radius: 4px; display: inline-block;
    margin: 8px 0;
  }
  .qr-section {
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    margin: 16px 0;
  }
  .qr-container { text-align: center; }
  .qr-label {
    font-size: 0.9em; color: #aaa; margin-bottom: 8px;
  }
  .qr-image { width: 200px; height: 200px; image-rendering: pixelated; }
  .instructions {
    background: #222; border-radius: 8px; padding: 16px;
    margin: 16px 0; font-size: 0.85em; line-height: 1.5;
  }
  .instructions h3 { color: #fff; margin-bottom: 8px; }
  .instructions ol { padding-left: 20px; }
  .instructions li { margin: 4px 0; color: #ccc; }
  .lan-info {
    font-size: 0.8em; color: #666; margin: 8px 0;
    text-align: center;
  }
  .status-section {
    margin-top: 16px;
  }
  .status-section h3 { color: #fff; margin-bottom: 8px; }
  .status-indicator {
    display: flex; align-items: center; gap: 6px;
    background: #222; padding: 8px 12px; border-radius: 4px;
    margin: 4px 0;
  }
  .status-dot {
    width: 8px; height: 8px; border-radius: 50%;
    background: #0f0;
  }
  .status-dot.listening { background: #0f0; }
  .status-dot.paired { background: #ffd700; }
  .status-dot.connected { background: #0f0; }
  .status-dot.idle { background: #666; }
  .peers-list {
    margin-top: 12px;
  }
  .peer-item {
    background: #2a2a2a; padding: 8px 12px;
    border-radius: 4px; margin: 4px 0;
    display: flex; justify-content: space-between;
    font-size: 0.8em;
  }
  .peer-item .name { color: #0f0; }
  .peer-item .caps { color: #888; font-size: 0.75em; }
  .log {
    margin-top: 12px; background: #111;
    padding: 12px; border-radius: 4px;
    font-size: 0.75em; color: #888;
    min-height: 60px; max-height: 120px; overflow-y: auto;
  }
  .log-entry { padding: 2px 0; border-bottom: 1px solid #222; }
  .footer {
    margin-top: 16px; text-align: center;
    font-size: 0.7em; color: #555;
  }
  #pairing-json { display: none; }
</style>
</head>
<body>
<div class="header">
  <h1>Sovereign App — Pairing</h1>
  <p>Desktop peer ready for initial WiFi connection</p>
  <div class="node-id">Node: <span id="nodeIdDisplay">${params.nodeId.slice(0, 16)}</span>…</div>
</div>

<div class="qr-section">
  ${qrHtml}
</div>

<div class="fingerprint">FP: ${params.fingerprint}</div>

<div class="instructions">
  <h3>Initial WiFi Setup</h3>
  <ol>
    <li>Open the mobile app on the same WiFi network</li>
    <li>Scan the QR code above, or the app will auto-discover this peer</li>
    <li>Verify the fingerprint matches what the phone shows</li>
    <li>Connection is authenticated via Ed25519 challenge-response</li>
    <li>Subsequent connections use Iroh QUIC (relay or direct hole-punch)</li>
  </ol>
</div>

<div class="lan-info">
  LAN advertisement on port ${params.advertisePort}
  · Direct connection via WiFi
</div>

<div class="status-section">
  <h3>Status</h3>
  <div class="status-indicator">
    <span class="status-dot listening"></span>
    <span>Listening for peers…</span>
  </div>
  <div id="statusLog"></div>
</div>

<div class="peers-list" id="peersList">
  <h3>Paired Devices</h3>
  <div id="pairedList">
    <p style="color:#666;font-size:0.8em">No paired devices yet</p>
  </div>
</div>

<div class="log" id="eventLog">
  <em style="color:#555">Ready for pairing…</em>
</div>

<div class="footer">
  Sovereign App Template · MIT License
</div>

<div id="pairing-json">${escapeHtml(qrText)}</div>

<script>
  const nodeId = '${params.nodeId}';
  const peerId = '${params.peerId}';
  const fingerprint = '${params.fingerprint}';

  /** Append a log entry to the event log. */
  function appendLog(text) {
    const log = document.getElementById('eventLog');
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.textContent = '> ' + text;
    log.appendChild(entry);
    log.scrollTop = log.scrollHeight;
  }

  /** Update status indicator. */
  function setStatus(status, detail) {
    const indicator = document.querySelector('.status-indicator');
    const dot = indicator.querySelector('.status-dot');
    dot.className = 'status-dot ' + status;
    indicator.querySelector('span:last-child').textContent = detail;
  }

  /** Add a peer to the paired list. */
  function addPairedPeer(hubId, caps) {
    const list = document.getElementById('pairedList');
    // Remove empty message
    const empty = list.querySelector('p');
    if (empty && list.children.length === 1) {
      list.removeChild(empty);
    }
    const item = document.createElement('div');
    item.className = 'peer-item';
    item.innerHTML = '<span class="name">' + escapeHtml(hubId) + '</span><span class="caps">' + escapeHtml(caps) + '</span>';
    list.appendChild(item);
  }

  /** Exposed for main process to call via executeJavaScript. */
  window.pairingUI = {
    onPeerScanned: function(hubId) {
      setStatus('paired', 'Mobile scanned — ' + hubId);
      appendLog('Mobile scanned QR: ' + hubId + ' — starting handshake');
    },
    onHandshakeProgress: function(step) {
      setStatus('idle', 'Handshake: ' + step);
      appendLog('Auth handshake: ' + step);
    },
    onPaired: function(hubId, capabilities) {
      setStatus('connected', 'Paired with ' + hubId);
      appendLog('Paired! Hub=' + hubId + ' Caps=' + capabilities.join(','));
      addPairedPeer(hubId, capabilities.join(', '));
    },
    onLanDiscovered: function(hubId, nodeId) {
      appendLog('LAN discovered: ' + hubId + ' (' + nodeId.slice(0, 12) + '…)');
    },
    appendLog: appendLog,
    setStatus: setStatus,
  };

  function escapeHtml(str) {
    return String(str).replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>').replace(/"/g, '"');
  }
</script>
</body>
</html>`;
}

/** Quick HTML escape for embedding strings. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/\$/g, '&#36;');
}

export type PairingUiHandle = {
  onPeerScanned(hubId: string): void;
  onHandshakeProgress(step: string): void;
  onPaired(hubId: string, capabilities: string[]): void;
  onLanDiscovered(hubId: string, nodeId: string): void;
  appendLog(text: string): void;
};

/** Create an Electron BrowserWindow with the pairing UI. Returns a handle for IPC. */
export async function createPairingWindow(params: {
  nodeId: string;
  peerId: string;
  qrPayload: PairingQrPayload;
  fingerprint: string;
  advertisePort: number;
}): Promise<PairingUiHandle> {
  await app.whenReady();

  const win = new BrowserWindow({
    width: 520,
    height: 780,
    title: `Sovereign App — ${params.peerId}`,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: undefined,
    },
  });

  const html = buildPairingHtml(params);
  win.loadURL(`data:text/html;base64,${Buffer.from(html).toString('base64')}`);

  return {
    onPeerScanned(hubId: string) {
      win.webContents.executeJavaScript(`window.pairingUI?.onPeerScanned(${JSON.stringify(hubId)})`);
    },
    onHandshakeProgress(step: string) {
      win.webContents.executeJavaScript(`window.pairingUI?.onHandshakeProgress(${JSON.stringify(step)})`);
    },
    onPaired(hubId: string, capabilities: string[]) {
      win.webContents.executeJavaScript(`window.pairingUI?.onPaired(${JSON.stringify(hubId)}, ${JSON.stringify(capabilities)})`);
    },
    onLanDiscovered(hubId: string, nodeId: string) {
      win.webContents.executeJavaScript(`window.pairingUI?.onLanDiscovered(${JSON.stringify(hubId)}, ${JSON.stringify(nodeId)})`);
    },
    appendLog(text: string) {
      win.webContents.executeJavaScript(
        `window.pairingUI?.appendLog(${JSON.stringify(text)})`,
      );
    },
  };
}
