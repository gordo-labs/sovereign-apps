#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { writeEvidence } from './evidence-lib.mjs';

const platform = process.argv[2];
const root = resolve(import.meta.dirname, '../..');
const evidenceDir = resolve(process.env.SOVEREIGN_EVIDENCE_DIR ?? 'artifacts/support-evidence');
const target = {
  'desktop-macos-arm64': ['pnpm', ['--filter', '@sovereign-apps/electron-app', 'build']],
  'desktop-macos-x64': ['pnpm', ['--filter', '@sovereign-apps/electron-app', 'build']],
  'desktop-windows-x64': ['pnpm', ['--filter', '@sovereign-apps/electron-app', 'build']],
  'desktop-linux-x64-glibc': ['pnpm', ['--filter', '@sovereign-apps/electron-app', 'build']],
  'ios-physical': ['pnpm', ['--filter', '@sovereign-apps/react-native-app', 'build:ios']],
  'android-physical': ['pnpm', ['--filter', '@sovereign-apps/react-native-app', 'build:android']]
}[platform];
if (!target) throw new Error(`Unknown native platform: ${platform}`);

const missingNativeProject = platform === 'ios-physical'
  ? !existsSync(`${root}/packages/react-native-app/ios/Podfile`)
  : platform === 'android-physical' ? !existsSync(`${root}/packages/react-native-app/android/gradlew`) : false;
let result = 'pass';
let notes = 'Build completed on the pinned runner.';
const logPath = resolve(evidenceDir, `${platform}-build-summary.txt`);
mkdirSync(evidenceDir, { recursive: true });
let output = '';
if (missingNativeProject) {
  result = 'blocked';
  notes = 'Native project is not present in this monorepo; a physical runner must supply the checked-in RN iOS/Android host before stable release.';
  output = `${notes}\n`;
} else {
  try {
    output = execFileSync(target[0], target[1], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (error) {
    result = 'fail';
    output = `${error.stdout ?? ''}\n${error.stderr ?? ''}`;
    notes = 'Native build command failed; inspect the runner output without attaching secrets.';
  }
}
writeFileSync(logPath, output.replace(/https?:\/\/[^\s]+/gi, '[redacted-url]').replace(/(token|secret|password|private|bearer|credential|endpoint|device.?id|node.?id)\s*[:=]\s*[^\s]+/gi, '$1=[redacted]'), 'utf8');
const evidence = writeEvidence({ root, evidenceDir, platformId: platform, caseId: 'native-build', result, notes, logs: [logPath] });
console.log(`${result}: ${evidence.path}`);
if (result !== 'pass') process.exitCode = 1;
