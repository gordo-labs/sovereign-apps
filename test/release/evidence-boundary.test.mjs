import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, readdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';

const run = promisify(execFile);
const root = resolve(import.meta.dirname, '../..');

test('physical pass evidence requires a sanitized attestation hash', async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'sovereign-evidence-'));
  const evidenceDir = join(temporary, 'evidence');
  const attestation = join(temporary, 'attestation.json');
  try {
    await assert.rejects(
      run(
        'node',
        [
          'scripts/release/record-evidence.mjs',
          '--platform',
          'ios-physical',
          '--case',
          'qr-scan-first-pair',
          '--result',
          'pass',
          '--evidence-dir',
          evidenceDir,
        ],
        { cwd: root },
      ),
      /attestation file is required/,
    );
    await writeFile(attestation, '{"sanitized":true}\n');
    await run(
      'node',
      [
        'scripts/release/record-evidence.mjs',
        '--platform',
        'ios-physical',
        '--case',
        'qr-scan-first-pair',
        '--result',
        'pass',
        '--attestation',
        attestation,
        '--evidence-dir',
        evidenceDir,
      ],
      { cwd: root },
    );
    const files = await readdir(evidenceDir);
    const evidence = JSON.parse(await readFile(join(evidenceDir, files[0]), 'utf8'));
    assert.match(evidence.physicalAttestationSha256, /^[0-9a-f]{64}$/);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});
