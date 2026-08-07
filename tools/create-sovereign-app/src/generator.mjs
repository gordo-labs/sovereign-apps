import fs from 'node:fs/promises';
import path from 'node:path';

export const MODULES = Object.freeze({
  protocol: { kind: 'protocol', platforms: ['electron', 'android', 'ios', 'web'], required: true },
  kernel: { kind: 'kernel', platforms: ['electron', 'android', 'ios', 'web'], required: true },
  electron: { kind: 'runtime', platforms: ['electron'], requires: ['protocol', 'kernel'] },
  reactNative: { kind: 'runtime', platforms: ['android', 'ios'], requires: ['protocol', 'kernel'] },
  qr: {
    kind: 'bootstrap',
    platforms: ['electron', 'android', 'ios'],
    requires: ['protocol', 'kernel'],
  },
  mdns: {
    kind: 'discovery',
    platforms: ['electron', 'android', 'ios'],
    requires: ['protocol', 'kernel'],
  },
  routePolicy: {
    kind: 'routing',
    platforms: ['electron', 'android', 'ios'],
    requires: ['protocol', 'kernel'],
  },
  bleBootstrap: {
    kind: 'bootstrap',
    platforms: ['android', 'ios'],
    requires: ['protocol', 'kernel'],
    optional: true,
  },
  offlineBootstrap: {
    kind: 'bootstrap',
    platforms: ['android', 'ios', 'web'],
    requires: ['protocol', 'kernel'],
    optional: true,
  },
  webPresence: { kind: 'presence', platforms: ['web'], requires: ['protocol', 'kernel'] },
  nextExample: { kind: 'example', platforms: ['web'], requires: ['webPresence'] },
  exampleCodec: { kind: 'codec', platforms: ['electron', 'android', 'ios', 'web'], optional: true },
});

// SA-015 is an explicit no-go: reject this name instead of allowing a generated
// app to imply that an unmeasured Bluetooth data adapter exists.
export const UNSUPPORTED_MODULES = Object.freeze({
  bluetoothTransport:
    'SA-015 no-go: Bluetooth is bootstrap-only until native physical evidence is published',
});

const SAFE = /^[a-z][a-z0-9-]{0,62}$/;
const PLATFORMS = ['electron', 'android', 'ios', 'web'];

export function parseList(value) {
  if (Array.isArray(value)) return value;
  return String(value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function validateConfig(input) {
  const config = {
    name: String(input.name ?? '').trim(),
    namespace: String(input.namespace ?? input.name ?? '').trim(),
    packageScope: String(input.packageScope ?? '@sovereign-apps').trim(),
    platforms: [...new Set(parseList(input.platforms))],
    modules: [...new Set(parseList(input.modules))],
    output: (input.output ?? input.dir) ? String(input.output ?? input.dir) : '.',
    packageManager: input.packageManager ?? 'pnpm',
  };
  const errors = [];
  if (!SAFE.test(config.name)) errors.push('name must be lowercase kebab-case (1-63 characters)');
  if (!SAFE.test(config.namespace))
    errors.push('namespace must be lowercase kebab-case (1-63 characters)');
  if (!/^@[a-z0-9][a-z0-9-]*$/.test(config.packageScope))
    errors.push('packageScope must be an npm scope such as @sovereign-apps');
  if (!config.platforms.length) errors.push('at least one platform is required');
  for (const platform of config.platforms)
    if (!PLATFORMS.includes(platform)) errors.push(`unsupported platform: ${platform}`);
  for (const moduleId of config.modules) {
    if (UNSUPPORTED_MODULES[moduleId]) errors.push(UNSUPPORTED_MODULES[moduleId]);
    else if (!MODULES[moduleId]) errors.push(`unknown module: ${moduleId}`);
  }
  for (const id of ['protocol', 'kernel'])
    if (!config.modules.includes(id)) config.modules.unshift(id);
  for (const id of config.modules) {
    const spec = MODULES[id];
    if (!spec) continue;
    const missing = (spec.requires ?? []).filter(
      (dependency) => !config.modules.includes(dependency),
    );
    if (missing.length) errors.push(`module ${id} requires ${missing.join(', ')}`);
    const supported = config.platforms.some((platform) => spec.platforms.includes(platform));
    if (!supported)
      errors.push(
        `module ${id} has no adapter for selected platforms (${config.platforms.join(', ')})`,
      );
  }
  if (config.modules.includes('electron') && !config.platforms.includes('electron'))
    errors.push('module electron requires platform electron');
  if (
    config.modules.includes('reactNative') &&
    !config.platforms.some((platform) => ['android', 'ios'].includes(platform))
  )
    errors.push('module reactNative requires android or ios');
  if (
    config.modules.includes('qr') &&
    (!config.platforms.includes('electron') ||
      !config.platforms.some((platform) => ['android', 'ios'].includes(platform)))
  )
    errors.push('module qr requires both an Electron endpoint and an Android/iOS client');
  if (config.modules.includes('nextExample') && !config.modules.includes('webPresence'))
    errors.push('module nextExample requires module webPresence');
  const output = path.resolve(config.output);
  if (config.output.split(/[\\/]/).includes('..'))
    errors.push('output may not contain parent-directory traversal');
  if (path.basename(output) !== config.name && config.output !== '.')
    errors.push(`output basename must match name (${config.name})`);
  if (errors.length) throw new Error(errors.join('; '));
  config.modules = [...new Set(config.modules)];
  config.platforms.sort();
  config.modules.sort();
  return Object.freeze(config);
}

function manifest(config) {
  return {
    schemaVersion: 1,
    generator: { name: 'create-sovereign-app', version: '0.1.0' },
    project: { name: config.name, namespace: config.namespace, packageScope: config.packageScope },
    platforms: config.platforms,
    modules: config.modules.map((id) => ({
      id,
      kind: MODULES[id].kind,
      optional: MODULES[id].optional === true,
    })),
    boundaries: {
      generated: ['sovereign-app.json', 'src/', 'README.md', 'package.json'],
      adopterOwned: ['app/', 'config/local/', 'secrets/'],
    },
    deployment: { packageManager: config.packageManager },
  };
}

function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function filesFor(config) {
  const files = new Map();
  const selected = config.modules;
  files.set('sovereign-app.json', json(manifest(config)));
  files.set(
    'package.json',
    json({
      name: config.name,
      private: true,
      version: '0.1.0',
      type: 'module',
      scripts: { check: 'node src/check.mjs' },
      license: 'MIT',
    }),
  );
  files.set(
    'README.md',
    `# ${config.name}\n\nGenerated by create-sovereign-app. This starter contains only the selected modules: ${selected.join(', ')}.\n\n## Run\n\nRun ${config.packageManager} run check to validate the generated manifest. Add application-owned code under app/; generated files under src/ may be regenerated when the manifest schema changes.\n\n## Boundaries\n\nThe generated project is transport/application neutral. Identity, pairing, transport and presence modules are integration points for the corresponding Sovereign Apps packages; no product-specific Music Hub code is copied. Keep secrets outside source control.\n`,
  );
  files.set(
    'src/check.mjs',
    `import fs from 'node:fs/promises';\nconst manifest = JSON.parse(await fs.readFile(new URL('../sovereign-app.json', import.meta.url)));\nif (manifest.schemaVersion !== 1) throw new Error('unsupported manifest schema');\nif (!manifest.project?.name || !Array.isArray(manifest.modules)) throw new Error('invalid sovereign-app.json');\nconsole.log('ok: ' + manifest.project.name + ' (' + manifest.modules.length + ' modules)');\n`,
  );
  files.set('src/manifest.mjs', `export const sovereignApp = ${json(manifest(config))};`);
  for (const id of selected) {
    const spec = MODULES[id];
    const filename = `src/modules/${id}.mjs`;
    files.set(
      filename,
      `/** Generated module descriptor; implementation remains in the selected Sovereign Apps adapter. */\nexport const module = Object.freeze({ id: ${JSON.stringify(id)}, kind: ${JSON.stringify(spec.kind)}, platforms: ${JSON.stringify(spec.platforms)} });\n`,
    );
  }
  if (selected.includes('electron'))
    files.set(
      'src/electron/README.md',
      '# Electron endpoint\n\nWire this module to `@sovereign-apps/electron-app` and keep the generated descriptor as the upgrade boundary.\n',
    );
  if (selected.includes('reactNative'))
    files.set(
      'src/react-native/README.md',
      '# React Native client\n\nWire this module to `@sovereign-apps/react-native-app`, which consumes the public `@gordo-labs/react-native-iroh` bridge.\n',
    );
  if (selected.includes('webPresence'))
    files.set(
      'src/web-presence/README.md',
      '# Web presence\n\nInstall `@sovereign-apps/web-presence` and expose its framework-neutral core through your web adapter. Presence is an optional untrusted cache; verify identity and authorization at the peer.\n',
    );
  if (selected.includes('nextExample'))
    files.set(
      'src/web-presence/next-example.md',
      '# Next.js example\n\nMount the `@sovereign-apps/web-presence/next` route factories from your own App Router route files. This is an installable example module, not a marketing landing.\n',
    );
  if (selected.includes('routePolicy'))
    files.set(
      'src/routing/README.md',
      '# Route policy\n\nUse `@sovereign-apps/route-policy` to rank local/direct candidates before optional relays without weakening pairing trust.\n',
    );
  if (selected.includes('bleBootstrap'))
    files.set(
      'src/bootstrap/ble.md',
      '# BLE bootstrap\n\nUse `@sovereign-apps/ble-bootstrap` only to exchange bounded bootstrap material; BLE proximity is never identity.\n',
    );
  if (selected.includes('offlineBootstrap'))
    files.set(
      'src/bootstrap/offline.md',
      '# Offline bootstrap\n\nUse `@sovereign-apps/offline-bootstrap` for validated deep-link, file/share or platform NFC handoff.\n',
    );
  if (selected.includes('exampleCodec'))
    files.set(
      'src/example-codec.mjs',
      '/** Minimal removable codec example. Do not use for production authentication. */\nexport const exampleCodec = { capabilities: [], encode: (value) => new TextEncoder().encode(JSON.stringify(value)), decode: (bytes) => JSON.parse(new TextDecoder().decode(bytes)), authorize: () => false };\n',
    );
  files.set(
    'LICENSES.md',
    '# Attribution\n\nThis generated scaffold is MIT licensed. Genericized patterns are derived from MIT-licensed Gordo Labs Music Streaming Hub code and the public `@gordo-labs/react-native-iroh` bridge. Confirm and preserve upstream notices when adopting implementation code.\n',
  );
  return files;
}

export function render(configInput) {
  const config = validateConfig(configInput);
  return { config, manifest: manifest(config), files: filesFor(config) };
}

export async function generate(configInput, { dryRun = false } = {}) {
  const rendered = render(configInput);
  const root = path.resolve(
    rendered.config.output === '.'
      ? path.join(process.cwd(), rendered.config.name)
      : rendered.config.output,
  );
  if (dryRun) return { ...rendered, root };
  try {
    const existing = await fs.readdir(root);
    if (existing.length && !existing.includes('sovereign-app.json'))
      throw new Error(`refusing to write non-generated directory: ${root}`);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  await fs.mkdir(root, { recursive: true });
  for (const [relative, content] of rendered.files) {
    const target = path.join(root, relative);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, content, 'utf8');
  }
  return { ...rendered, root };
}
