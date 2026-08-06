import { BrowserWindow } from 'electron';
import type { EndpointState, IrohCandidate, IrohNode } from './iroh-node.js';
import { buildDiagnosticHtml } from './diagnostic-html.js';
export { buildDiagnosticHtml } from './diagnostic-html.js';

export type DiagnosticSnapshot = {
  nodeId: string;
  fingerprint: string;
  state: EndpointState;
  candidates: readonly IrohCandidate[];
  sessions: number;
  lastError?: string;
};

export async function createDiagnosticWindow(snapshot: DiagnosticSnapshot): Promise<BrowserWindow> {
  const window = new BrowserWindow({
    width: 760,
    height: 620,
    title: 'Sovereign Apps diagnostics',
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });
  await window.loadURL(`data:text/html;base64,${Buffer.from(buildDiagnosticHtml(snapshot)).toString('base64')}`);
  return window;
}

export function snapshotForNode(node: IrohNode, fingerprint: string, sessions = 0): DiagnosticSnapshot {
  return { nodeId: node.nodeId, fingerprint, state: node.state, candidates: node.candidates, sessions, lastError: node.lastError };
}
