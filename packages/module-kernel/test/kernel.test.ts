import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ModuleCompositionError,
  ModuleRegistry,
  defineManifest,
  runModuleLifecycleConformance,
} from '../dist/index.js';
import type { ModuleContext, SovereignModule } from '../src/types.ts';

const context: ModuleContext = {
  signal: new AbortController().signal,
  platform: 'node',
  now: Date.now,
};
function module(
  id: string,
  manifest: Partial<Parameters<typeof defineManifest>[0]> = {},
  available = true,
): SovereignModule {
  let state: SovereignModule['state'] = 'idle';
  return {
    manifest: defineManifest({ id, version: '1.0.0', kind: 'diagnostics', ...manifest }),
    availability: { available },
    get state() {
      return state;
    },
    async start() {
      if (state === 'ready') return;
      state = 'ready';
    },
    async stop() {
      if (state === 'stopped') return;
      state = 'stopped';
    },
  };
}

test('lifecycle is idempotent', async () => {
  await runModuleLifecycleConformance(module('memory.diagnostics'), context);
});
test('registry rejects missing dependencies before startup side effects', async () => {
  const registry = new ModuleRegistry();
  const child = module('transport.memory', {
    kind: 'transport',
    dependencies: ['identity.memory'],
  });
  registry.register(child);
  await assert.rejects(() => registry.start(['transport.memory'], context), ModuleCompositionError);
});
test('optional unavailable modules do not prevent core composition', () => {
  const registry = new ModuleRegistry();
  registry.register(module('identity.memory', { kind: 'identity' }));
  registry.register(module('ble.bootstrap', { kind: 'bootstrap', optional: true }, false));
  const result = registry.validate(['identity.memory', 'ble.bootstrap'], 'node');
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.composition.optionalFailures, ['ble.bootstrap']);
  assert.deepEqual(
    result.composition.modules.map((m) => m.manifest.id),
    ['identity.memory'],
  );
});
test('conflicts are reported as actionable errors', () => {
  const registry = new ModuleRegistry();
  registry.register(module('iroh.transport', { kind: 'transport', conflicts: ['raw.transport'] }));
  registry.register(module('raw.transport', { kind: 'transport' }));
  assert.equal(
    registry.validate(['iroh.transport', 'raw.transport'], 'node').errors[0].code,
    'invalid_composition',
  );
});
test('required config is checked before module startup', () => {
  const registry = new ModuleRegistry();
  registry.register(
    module('identity.file', {
      kind: 'identity',
      configSchema: [{ name: 'path', type: 'string', required: true }],
    }),
  );
  const result = registry.validate(['identity.file'], 'node');
  assert.match(result.errors[0].message, /config\.path/);
});
test('optional startup failure is observable but does not fail core readiness', async () => {
  let starts = 0;
  const optional = module('ble.optional', { kind: 'bootstrap', optional: true });
  optional.start = async () => {
    starts += 1;
    throw new Error('not supported');
  };
  const registry = new ModuleRegistry();
  registry.register(module('identity.memory', { kind: 'identity' }));
  registry.register(optional);
  const events: unknown[] = [];
  const composition = await registry.start(['ble.optional', 'identity.memory'], {
    ...context,
    diagnostics: { emit: (event) => events.push(event) },
  });
  assert.equal(starts, 1);
  assert.deepEqual(
    composition.modules.map((m) => m.manifest.id),
    ['identity.memory'],
  );
  assert.deepEqual(composition.optionalFailures, ['ble.optional']);
  assert.equal(events.length, 1);
});
