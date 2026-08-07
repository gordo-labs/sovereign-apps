import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDiagnosticHtml } from '../dist/diagnostic-html.js';

test('escapes peer-controlled diagnostic values', () => {
  const html = buildDiagnosticHtml({
    nodeId: '<script>alert(1)</script>',
    fingerprint: '" onerror="alert(2)',
    state: 'ready',
    candidates: [{ kind: 'direct', address: '<img src=x onerror=alert(3)>' }],
    sessions: 1,
    lastError: '<script>alert(4)</script>',
  });
  assert.equal(html.includes('<script>alert(1)'), false);
  assert.equal(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'), true);
  assert.equal(html.includes('onerror="alert(3)"'), false);
});
