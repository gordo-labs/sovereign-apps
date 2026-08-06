import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { generate, render, validateConfig } from '../src/generator.mjs';

const base = {
  name: 'demo-app',
  platforms: 'android,electron',
  modules: 'electron,reactNative,qr',
};

test('renders deterministic minimal desktop/mobile variant', () => {
  const first = render(base);
  const second = render(base);
  assert.deepEqual([...first.files], [...second.files]);
  assert.deepEqual(first.manifest, second.manifest);
  assert.ok(first.files.has('src/modules/qr.mjs'));
  assert.equal(first.files.has('src/web-presence/README.md'), false);
});

test('supports desktop-only and local-only variants without unselected modules', () => {
  const desktop = render({
    name: 'desktop-app',
    platforms: 'electron',
    modules: 'electron,exampleCodec',
  });
  assert.ok(desktop.files.has('src/electron/README.md'));
  assert.equal(desktop.files.has('src/modules/qr.mjs'), false);
  const local = render({ name: 'local-app', platforms: 'web', modules: 'webPresence,nextExample' });
  assert.ok(local.files.has('src/web-presence/next-example.md'));
  assert.equal(local.files.has('src/electron/README.md'), false);
});

test('rejects unsafe names, paths and dependency/platform errors', () => {
  assert.throws(() => validateConfig({ ...base, name: '../escape' }), /lowercase kebab-case/);
  assert.throws(() => validateConfig({ ...base, name: 'demo-app', dir: '../escape' }), /traversal/);
  assert.throws(
    () => validateConfig({ name: 'web-only', platforms: 'web', modules: 'nextExample' }),
    /requires module webPresence/,
  );
  assert.throws(
    () => validateConfig({ name: 'mobile', platforms: 'android', modules: 'qr,reactNative' }),
    /requires both/,
  );
  assert.throws(
    () => validateConfig({ name: 'bad', platforms: 'desktop', modules: 'electron' }),
    /unsupported platform/,
  );
  assert.throws(
    () => validateConfig({ name: 'bt', platforms: 'android', modules: 'bluetoothTransport' }),
    /SA-015 no-go/,
  );
});

test('generates, checks, and safely repeats into a temporary directory', async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'sovereign-generator-'));
  const output = path.join(temp, 'demo-app');
  const first = await generate({ ...base, output });
  const before = await fs.readFile(path.join(output, 'sovereign-app.json'), 'utf8');
  await generate({ ...base, output });
  const after = await fs.readFile(path.join(output, 'sovereign-app.json'), 'utf8');
  assert.equal(before, after);
  const check = await import(`file://${path.join(output, 'src/check.mjs')}`);
  assert.ok(check);
  assert.equal(first.root, output);
  await fs.rm(temp, { recursive: true, force: true });
});

test('dry-run never writes files', async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'sovereign-generator-dry-'));
  const output = path.join(temp, 'dry-app');
  const result = await generate({ ...base, name: 'dry-app', output }, { dryRun: true });
  assert.equal(result.root, output);
  await assert.rejects(fs.access(output));
  await fs.rm(temp, { recursive: true, force: true });
});
