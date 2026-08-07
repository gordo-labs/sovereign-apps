#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const packageDir = resolve(process.cwd());
const packageFile = join(packageDir, 'package.json');
const backupFile = join(
  process.env.TMPDIR ?? '/tmp',
  `sovereign-apps-prepack-${createHash('sha256').update(packageDir).digest('hex')}.json`,
);

if (existsSync(backupFile)) {
  writeFileSync(packageFile, readFileSync(backupFile));
  unlinkSync(backupFile);
  console.error(
    `postpack: restored source manifest for ${JSON.parse(readFileSync(packageFile, 'utf8')).name}`,
  );
}
