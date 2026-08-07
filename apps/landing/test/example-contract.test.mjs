import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('..', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('example has the documented neutral route surface', async () => {
  const routes = await Promise.all([
    read('src/app/api/health/route.ts'),
    read('src/app/api/web-presence/bootstrap/route.ts'),
    read('src/app/api/web-presence/presence/[identity]/route.ts'),
    read('src/app/api/web-presence/signaling/[identity]/[sessionId]/route.ts'),
  ]);
  assert.match(routes[0], /service: 'web-presence-example'/);
  assert.match(routes[1], /createBootstrapRoute/);
  assert.match(routes[2], /createPresenceRoute/);
  assert.match(routes[3], /createSignalingRoute/);
});

test('example has no fake peers or product landing copy', async () => {
  const source = await Promise.all([
    read('src/app/page.tsx'),
    read('src/app/presence-inspector.tsx'),
  ]);
  const joined = source.join('\n');
  assert.doesNotMatch(joined, /PRISONS|fake|simulat|connected peer|Interactive Demo/i);
  assert.match(joined, /untrusted|not proof|not-found|error/);
});

test('diagnostic output is sanitized and excludes signatures and addresses', async () => {
  const source = await read('src/app/presence-inspector.tsx');
  assert.doesNotMatch(
    source,
    /record\.(signature|address|payload)|<dt>Signature|<dt>Address|<dt>Payload/,
  );
  assert.match(source, /candidateKinds/);
});
