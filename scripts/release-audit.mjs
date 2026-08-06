#!/usr/bin/env node
/**
 * Dry-run release gate. It intentionally uses pnpm pack so workspace:* ranges
 * are resolved to semver in the candidate manifest. It never publishes.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const root = resolve(new URL('..', import.meta.url).pathname);
const publishable = [
  'protocol',
  'module-kernel',
  'route-policy',
  'web-presence',
  'ble-bootstrap',
  'offline-bootstrap'
];
const forbidden = /(^|\/)(node_modules|src|test|tests|\.git|\.env)(\/|$)|(^|\/)(pnpm-lock\.yaml|.*\.pem|.*\.key|.*\.p12|.*\.tgz)$/i;

async function manifest(name) {
  return JSON.parse(await readFile(join(root, 'packages', name, 'package.json'), 'utf8'));
}

async function pack(name, destination) {
  const cwd = join(root, 'packages', name);
  const { stdout } = await run('pnpm', ['pack', '--json', '--pack-destination', destination], { cwd });
  const parsed = JSON.parse(stdout.trim());
  return parsed[0] ?? parsed;
}

async function main() {
  const packMode = process.argv.includes('--pack');
  const destination = resolve(root, 'artifacts/release');
  await mkdir(destination, { recursive: true });
  const report = { generatedAt: new Date().toISOString(), commit: process.env.GITHUB_SHA ?? 'local', packages: [] };
  const errors = [];

  for (const name of publishable) {
    const pkg = await manifest(name);
    if (!pkg.publishConfig?.provenance) errors.push(`${name}: publishConfig.provenance must be true`);
    if (pkg.private) errors.push(`${name}: publishable package cannot be private`);
    if (!pkg.repository?.directory) errors.push(`${name}: repository.directory is required`);
    const result = await pack(name, destination);
    const files = (result.files ?? []).map((entry) => entry.path ?? entry);
    const bad = files.filter((file) => forbidden.test(file));
    if (bad.length) errors.push(`${name}: forbidden files in tarball: ${bad.join(', ')}`);
    if (!files.includes('README.md') || !files.includes('LICENSE') || !files.some((file) => /^dist\//.test(file))) {
      errors.push(`${name}: tarball must contain README.md, LICENSE and dist/`);
    }
    const filename = result.filename ? result.filename.split('/').pop() : `${name.replaceAll('/', '-')}-${pkg.version}.tgz`;
    const entry = { name: pkg.name, version: pkg.version, filename, files, integrity: result.integrity, shasum: result.shasum };
    if (packMode) {
      const bytes = await readFile(join(destination, filename));
      entry.sha256 = createHash('sha256').update(bytes).digest('hex');
    }
    report.packages.push(entry);
  }

  const components = [];
  for (const name of publishable) {
    const pkg = await manifest(name);
    for (const [dep, version] of Object.entries({ ...pkg.dependencies, ...pkg.optionalDependencies, ...pkg.peerDependencies })) {
      components.push({ type: 'library', name: dep, version: String(version), scope: 'required-by-' + pkg.name });
    }
  }
  const sbom = {
    bomFormat: 'CycloneDX', specVersion: '1.5', serialNumber: `urn:uuid:sovereign-apps-${Date.now()}`,
    metadata: { timestamp: report.generatedAt, tools: [{ vendor: 'Gordo Labs', name: 'sovereign-apps release-audit', version: '0.0.1' }] },
    components: [...new Map(components.map((component) => [`${component.name}@${component.version}`, component])).values()]
  };
  await writeFile(join(destination, 'release-report.json'), JSON.stringify(report, null, 2) + '\n');
  await writeFile(join(destination, 'sbom.cdx.json'), JSON.stringify(sbom, null, 2) + '\n');
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exitCode = 1;
  } else {
    console.log(`${packMode ? 'Packed' : 'Audited'} ${report.packages.length} release candidates; no forbidden files found.`);
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
