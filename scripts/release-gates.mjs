import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const run = (command, args, label, cwd = root) => {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', shell: false });
  if (result.status !== 0) throw new Error(`${label} failed with exit ${result.status}`);
};

const manifest = JSON.parse(await readFile(resolve(root, 'docs/support-evidence.json'), 'utf8'));
if (manifest.containsSecrets !== false || !manifest.schemaVersion)
  throw new Error('Invalid support evidence manifest');

const packageDirs = ['packages', 'tools', 'apps'];
const packageJsons = [];
for (const parent of packageDirs) {
  const listing = spawnSync(
    'find',
    [resolve(root, parent), '-mindepth', '2', '-maxdepth', '2', '-name', 'package.json', '-print'],
    { encoding: 'utf8' },
  );
  for (const file of listing.stdout.split('\n').filter(Boolean)) packageJsons.push(file);
}
const releaseDirs = [];
for (const file of packageJsons) {
  const pkg = JSON.parse(await readFile(file, 'utf8'));
  if (pkg.private) continue;
  releaseDirs.push(resolve(file, '..'));
  if (!pkg.scripts?.test)
    throw new Error(`${pkg.name} has no test script; empty suites are forbidden`);
  const dir = resolve(file, '..');
  if (!existsSync(resolve(dir, 'test'))) throw new Error(`${pkg.name} has no test directory`);
}

run('pnpm', ['install', '--frozen-lockfile'], 'frozen install');
run('pnpm', ['format:check'], 'format check');
run('pnpm', ['lint'], 'lint');
run('pnpm', ['typecheck'], 'typecheck');
run('pnpm', ['test'], 'workspace tests');
run('pnpm', ['test:e2e'], 'contract E2E');
run('pnpm', ['build'], 'workspace build');
// pnpm 9 has no pack dry-run flag. npm's dry-run mode is package-manager
// independent and does not write tarballs, so use it per publishable package.
for (const dir of releaseDirs)
  run('npm', ['pack', '--dry-run', '--ignore-scripts', '--json'], `package dry-run (${dir})`, dir);
run('pnpm', ['release:install-test'], 'external package install test');
console.log(`release gates passed: ${packageJsons.length} workspace manifests checked`);
