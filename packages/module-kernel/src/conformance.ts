import assert from 'node:assert/strict';
import type { ModuleContext, SovereignModule, TransportEndpoint } from './types.js';
import { OperationCancelledError } from './errors.js';

export async function runModuleLifecycleConformance(
  module: SovereignModule,
  context: ModuleContext,
): Promise<void> {
  assert.equal(module.state, 'idle');
  await module.start(context);
  assert.equal(module.state, 'ready');
  await module.start(context);
  assert.equal(module.state, 'ready');
  await module.stop();
  assert.equal(module.state, 'stopped');
  await module.stop();
  assert.equal(module.state, 'stopped');
}

export async function runTransportConformance(
  endpoint: TransportEndpoint,
  context: ModuleContext,
): Promise<void> {
  await runModuleLifecycleConformance(endpoint, context);
  const candidates = await endpoint.candidates(context.signal);
  assert.ok(Array.isArray(candidates));
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    () =>
      endpoint.connect(candidates[0] ?? { id: 'none', kind: 'memory', address: 'memory:' }, {
        signal: controller.signal,
      }),
    (error: unknown) =>
      error instanceof OperationCancelledError ||
      (error instanceof Error && error.name === 'AbortError'),
  );
}
