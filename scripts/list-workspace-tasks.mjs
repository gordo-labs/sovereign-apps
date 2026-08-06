import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const roots = ['packages', 'apps'];

for (const root of roots) {
  let entries = [];
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    continue;
  }

  for (const entry of entries
    .filter((item) => item.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name))) {
    const packagePath = join(root, entry.name, 'package.json');
    try {
      const manifest = JSON.parse(await readFile(packagePath, 'utf8'));
      const scripts = Object.keys(manifest.scripts ?? {}).sort();
      console.log(`${manifest.name ?? packagePath}: ${scripts.join(', ') || '(no scripts)'}`);
    } catch {
      // A workspace directory without a manifest is not a package task target.
    }
  }
}
