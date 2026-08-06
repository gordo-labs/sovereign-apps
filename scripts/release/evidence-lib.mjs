import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, basename } from 'node:path';

const SENSITIVE = /(qr|token|secret|private|bearer|password|credential|endpoint|device.?id|node.?id|key)/i;

export function gitCommit() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    return '0000000';
  }
}

export function sanitizeText(value, limit = 2000) {
  const text = String(value ?? '').replace(/https?:\/\/[^\s]+/gi, '[redacted-url]');
  if (SENSITIVE.test(text)) throw new Error('Sensitive field detected; do not put keys, tokens, QR data or endpoints in evidence.');
  return text.replace(/\s+/g, ' ').trim().slice(0, limit);
}

export function hashFile(path) {
  const content = readFileSync(path);
  return createHash('sha256').update(content).digest('hex');
}

export function packageVersions(root) {
  const result = {};
  for (const path of ['package.json', 'packages/protocol/package.json', 'packages/electron-app/package.json', 'packages/react-native-app/package.json', 'packages/web-presence/package.json']) {
    try {
      const pkg = JSON.parse(readFileSync(`${root}/${path}`, 'utf8'));
      result[pkg.name] = pkg.version;
    } catch {
      // A partially checked-out package is represented by the missing value in the manifest.
    }
  }
  return result;
}

export function toolchainVersions() {
  const commands = { node: ['node', ['--version']], pnpm: ['pnpm', ['--version']], ruby: ['ruby', ['--version']], java: ['java', ['-version']], xcodebuild: ['xcodebuild', ['-version']], gradle: ['gradle', ['--version']] };
  const versions = {};
  for (const [name, [command, args]] of Object.entries(commands)) {
    try {
      versions[name] = execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).split('\n')[0].trim().slice(0, 160);
    } catch {
      versions[name] = null;
    }
  }
  return versions;
}

export function writeEvidence({ root, evidenceDir, platformId, caseId, result, deviceClass = null, osVersionClass = null, durationSeconds = null, notes = '', logs = [] }) {
  if (!/^[a-z0-9-]{3,80}$/.test(platformId) || !/^[a-z0-9-]{3,80}$/.test(caseId)) throw new Error('platformId and caseId must be lowercase identifiers.');
  if (!['pass', 'fail', 'skipped', 'blocked'].includes(result)) throw new Error(`Unsupported result: ${result}`);
  const safeLogs = logs.map((path) => {
    if (SENSITIVE.test(basename(path))) throw new Error(`Sensitive log filename: ${basename(path)}`);
    return { name: basename(path).replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 120), sha256: hashFile(path) };
  });
  const evidence = {
    schemaVersion: '1.0', evidenceId: `${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`,
    platformId, caseId, commit: gitCommit(), generatedAt: new Date().toISOString(), result,
    deviceClass: deviceClass ? sanitizeText(deviceClass, 120) : null,
    osVersionClass: osVersionClass ? sanitizeText(osVersionClass, 120) : null,
    durationSeconds: durationSeconds == null ? null : Number(durationSeconds), notes: sanitizeText(notes), sanitized: true,
    logs: safeLogs, packages: packageVersions(root), toolchain: toolchainVersions()
  };
  mkdirSync(evidenceDir, { recursive: true });
  const path = `${evidenceDir}/${evidence.evidenceId}.json`;
  writeFileSync(path, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  return { evidence, path };
}

export { SENSITIVE };
