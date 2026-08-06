#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { writeEvidence } from './evidence-lib.mjs';

function args(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    out[key] = argv[i + 1]?.startsWith('--') ? true : argv[++i];
  }
  return out;
}

const options = args(process.argv.slice(2));
const required = ['platform', 'case', 'result'];
for (const key of required) if (!options[key]) throw new Error(`Missing --${key}`);
const root = resolve(import.meta.dirname, '../..');
const logs = options.log ? String(options.log).split(',').map((path) => resolve(path)) : [];
for (const path of logs) if (!existsSync(path)) throw new Error(`Log does not exist: ${path}`);
const { path } = writeEvidence({ root, evidenceDir: resolve(options['evidence-dir'] ?? 'artifacts/support-evidence'), platformId: options.platform, caseId: options.case, result: options.result, deviceClass: options['device-class'], osVersionClass: options['os-class'], durationSeconds: options.duration, notes: options.notes, logs });
console.log(`Support evidence written: ${path}`);
