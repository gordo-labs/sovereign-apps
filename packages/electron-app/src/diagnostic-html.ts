import type { DiagnosticSnapshot } from './diagnostic-ui.js';

export function buildDiagnosticHtml(snapshot: DiagnosticSnapshot): string {
  const safe = (value: unknown) => escapeHtml(String(value ?? ''));
  const candidates = snapshot.candidates.map((candidate) => `<li><code>${safe(candidate.kind)}</code> ${safe(candidate.address)}</li>`).join('') || '<li>none</li>';
  return `<!doctype html><meta charset="utf-8"><title>Sovereign Apps diagnostics</title><style>body{font:14px system-ui;background:#111;color:#eee;padding:24px}code,pre{font-family:ui-monospace,monospace}section{background:#1d1d1d;border-radius:8px;padding:14px;margin:10px 0}li{margin:5px 0;word-break:break-all}.error{color:#ff8e8e}</style><h1>Sovereign Apps</h1><section><div>State: <strong>${safe(snapshot.state)}</strong></div><div>Node ID: <code>${safe(snapshot.nodeId)}</code></div><div>App fingerprint: <code>${safe(snapshot.fingerprint)}</code></div></section><section><h2>Connection candidates</h2><ul>${candidates}</ul></section><section>Active sessions: <strong>${safe(snapshot.sessions)}</strong></section>${snapshot.lastError ? `<section class="error">Last error: ${safe(snapshot.lastError)}</section>` : ''}`;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
