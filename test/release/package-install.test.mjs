import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { test } from 'node:test';

const run = promisify(execFile);
const root = resolve(import.meta.dirname, '../..');
const packages = [
  'protocol',
  'module-kernel',
  'route-policy',
  'web-presence',
  'ble-bootstrap',
  'offline-bootstrap',
];
const dependencyFields = ['dependencies', 'optionalDependencies', 'peerDependencies'];

async function packageManifest(name) {
  return JSON.parse(await readFile(join(root, 'packages', name, 'package.json'), 'utf8'));
}

async function pack(name, destination) {
  const packageDir = join(root, 'packages', name);
  const before = new Set(await readdir(destination));
  await run('npm', ['pack', '--json', '--pack-destination', destination], {
    cwd: packageDir,
  });
  const files = (await readdir(destination)).filter(
    (file) => file.endsWith('.tgz') && !before.has(file),
  );
  assert.equal(files.length, 1, `npm pack must create one tarball for ${name}`);
  return join(destination, files[0]);
}

async function packedManifest(archive) {
  const { stdout } = await run('tar', ['-xOf', archive, 'package/package.json']);
  return JSON.parse(stdout);
}

test('npm tarballs have installable semver dependencies and install externally', async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'sovereign-apps-release-'));
  const archives = [];
  try {
    for (const name of packages) {
      const source = await packageManifest(name);
      const archive = await pack(name, temporary);
      archives.push({ name, archive, manifest: await packedManifest(archive) });
      assert.deepEqual(
        await packageManifest(name),
        source,
        `${name} source manifest was not restored`,
      );
    }

    for (const { name, manifest } of archives) {
      for (const field of dependencyFields) {
        for (const [dependency, range] of Object.entries(manifest[field] ?? {})) {
          assert.doesNotMatch(
            String(range),
            /^workspace:/,
            `${name} publishes an unusable workspace dependency ${dependency}@${range}`,
          );
          assert.match(
            String(range),
            /^(?:[~^]?\d+(?:\.\d+){1,2}(?:[-+][0-9A-Za-z.-]+)?)$/,
            `${name} dependency ${dependency} is not a concrete semver range: ${range}`,
          );
        }
      }
    }

    const fixture = join(temporary, 'fixture');
    const dependencies = Object.fromEntries(
      archives.map(({ manifest, archive }) => [manifest.name, `file:${archive}`]),
    );
    await mkdir(fixture);
    await writeFile(
      join(fixture, 'package.json'),
      `${JSON.stringify({ name: 'sovereign-apps-external-fixture', private: true, type: 'module', dependencies }, null, 2)}\n`,
    );
    await run(
      'npm',
      ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--package-lock=false'],
      { cwd: fixture },
    );
    const importCheck = archives
      .map(({ manifest }) => `await import(${JSON.stringify(manifest.name)});`)
      .join('\n');
    await run('node', ['--input-type=module', '-e', importCheck], { cwd: fixture });
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});
