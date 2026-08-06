#!/usr/bin/env node
import { createHash, createPublicKey, sign } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { packageVersions, gitCommit } from './evidence-lib.mjs';

function args(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    out[key] = argv[i + 1]?.startsWith('--') ? true : argv[++i];
  }
  return out;
}
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
function readJson(path) { return JSON.parse(readFileSync(path, 'utf8')); }
function files(dir) { return existsSync(dir) ? readdirSync(dir).filter((name) => name.endsWith('.json')).map((name) => resolve(dir, name)) : []; }

const options = args(process.argv.slice(2));
const root = resolve(import.meta.dirname, '../..');
const matrix = readJson(`${root}/release/support-matrix.json`);
const evidenceDir = resolve(options['evidence-dir'] ?? 'artifacts/support-evidence');
const output = resolve(options.output ?? 'artifacts/support-manifest.json');
const maxAgeHours = Number(options['max-age-hours'] ?? (options.channel === 'stable' ? 72 : 168));
const now = Date.now();
const evidence = files(evidenceDir).map(readJson).filter((item) => item.schemaVersion === '1.0');
const required = [];
for (const platform of matrix.platforms.filter((item) => item.requiredForStable)) {
  const cases = platform.physical ? matrix.mandatoryCases : ['native-build'];
  for (const caseId of cases) required.push({ platformId: platform.id, caseId });
}
const missing = [], stale = [], failed = [];
for (const item of required) {
  const matches = evidence.filter((entry) => entry.platformId === item.platformId && entry.caseId === item.caseId).sort((a, b) => Date.parse(b.generatedAt) - Date.parse(a.generatedAt));
  const latest = matches[0];
  if (!latest) { missing.push(item); continue; }
  if (now - Date.parse(latest.generatedAt) > maxAgeHours * 3600000) { stale.push({ ...item, evidenceId: latest.evidenceId }); continue; }
  if (latest.result !== 'pass') failed.push({ ...item, result: latest.result, evidenceId: latest.evidenceId });
}
const unsigned = !process.env.SOVEREIGN_EVIDENCE_PRIVATE_KEY;
const issues = [...missing.map((item) => ({ type: 'missing', ...item })), ...stale.map((item) => ({ type: 'stale', ...item })), ...failed.map((item) => ({ type: 'failed', ...item }))];
if (unsigned) issues.push({ type: 'unsigned' });
const manifest = {
  schemaVersion: '1.0', channel: options.channel ?? 'ci', generatedAt: new Date().toISOString(), commit: gitCommit(),
  supportMatrixVersion: matrix.schemaVersion, requiredEvidenceWindowHours: maxAgeHours, packages: packageVersions(root),
  summary: { status: issues.length ? 'red' : 'green', stableEligible: issues.length === 0, missing, stale, failed, unsigned },
  evidence: evidence.map(({ evidenceId, platformId, caseId, commit, generatedAt, result, deviceClass, osVersionClass, packages, toolchain, logs }) => ({ evidenceId, platformId, caseId, commit, generatedAt, result, deviceClass, osVersionClass, packages, toolchain, logs })),
  signature: { algorithm: 'ed25519', signed: false, publicKeySha256: null, value: null }
};
const payload = canonical(manifest);
if (!unsigned) {
  const privateKey = process.env.SOVEREIGN_EVIDENCE_PRIVATE_KEY;
  const signature = sign(null, Buffer.from(payload), privateKey).toString('base64');
  const publicKey = createPublicKey(privateKey).export({ type: 'spki', format: 'der' });
  manifest.signature = { algorithm: 'ed25519', signed: true, publicKeySha256: createHash('sha256').update(publicKey).digest('hex'), value: signature };
}
if (options['require-signature'] && unsigned) { manifest.summary.status = 'red'; manifest.summary.stableEligible = false; }
mkdirSync(resolve(output, '..'), { recursive: true });
writeFileSync(output, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`${manifest.summary.status}: ${output}`);
if (options.channel === 'stable' && !manifest.summary.stableEligible) process.exitCode = 1;
