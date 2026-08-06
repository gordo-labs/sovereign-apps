#!/usr/bin/env node
/**
 * npm does not understand pnpm's workspace protocol when it packs or
 * publishes a package. Convert workspace ranges to concrete semver only for
 * the duration of the npm prepack lifecycle; postpack restores the source
 * manifest byte-for-byte.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const packageDir = resolve(process.cwd());
const packageFile = join(packageDir, 'package.json');
const root = resolve(packageDir, '..', '..');
const backupFile = join(
  process.env.TMPDIR ?? '/tmp',
  `sovereign-apps-prepack-${createHash('sha256').update(packageDir).digest('hex')}.json`,
);
const dependencyFields = ['dependencies', 'optionalDependencies', 'peerDependencies'];

function packageMap() {
  const map = new Map();
  for (const parent of ['packages', 'apps']) {
    const directory = join(root, parent);
    if (!existsSync(directory)) continue;
    for (const child of readdirSync(directory, { withFileTypes: true })) {
      if (!child.isDirectory()) continue;
      const file = join(directory, child.name, 'package.json');
      if (!existsSync(file)) continue;
      const manifest = JSON.parse(readFileSync(file, 'utf8'));
      if (manifest.name && manifest.version) map.set(manifest.name, manifest.version);
    }
  }
  return map;
}

function publishedRange(name, range, versions) {
  if (!range.startsWith('workspace:')) return range;
  const suffix = range.slice('workspace:'.length);
  const version = versions.get(name);
  if (!version) throw new Error(`Cannot resolve workspace dependency ${name}`);
  if (suffix === '*' || suffix === '') return version;
  if (suffix === '^') return `^${version}`;
  if (suffix === '~') return `~${version}`;
  if (/^[~^]?\d/.test(suffix)) return suffix;
  throw new Error(`Unsupported workspace range ${range} for ${name}`);
}

const source = readFileSync(packageFile, 'utf8');
const manifest = JSON.parse(source);
const versions = packageMap();
let changed = false;
for (const field of dependencyFields) {
  for (const [name, range] of Object.entries(manifest[field] ?? {})) {
    const next = publishedRange(name, String(range), versions);
    if (next !== range) {
      manifest[field][name] = next;
      changed = true;
    }
  }
}

if (changed) {
  writeFileSync(backupFile, source, 'utf8');
  writeFileSync(packageFile, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.error(`prepack: resolved workspace dependencies for ${manifest.name}`);
} else if (existsSync(backupFile)) {
  throw new Error(`stale prepack backup exists: ${backupFile}`);
}
