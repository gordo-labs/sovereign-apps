import { defineManifest, type ModuleContext, type LifecycleState } from '@sovereign-apps/module-kernel';
import { LocalFirstRoutePolicy } from './policy.js';
import type { RouteModule, RoutePolicyDependencies, RoutePolicyLike, RoutePolicyOptions } from './types.js';

export class RoutePolicyModule implements RouteModule {
  readonly manifest = defineManifest({
    id: 'route.local-first', version: '0.0.1', kind: 'route' as const,
    capabilities: ['rank', 'race', 'reconnect', 'circuit-health'],
    optional: false,
  });
  readonly availability = { available: true, platforms: ['node', 'electron', 'ios', 'android', 'web'] as const };
  private lifecycle: LifecycleState = 'idle';
  private readonly instance: LocalFirstRoutePolicy;
  constructor(dependencies: RoutePolicyDependencies = {}, readonly defaults: RoutePolicyOptions = {}) { this.instance = new LocalFirstRoutePolicy(dependencies); }
  get state() { return this.lifecycle; }
  get policy(): RoutePolicyLike { return this.instance; }
  async start(_context: ModuleContext) { if (this.lifecycle === 'ready') return; this.lifecycle = 'ready'; }
  async stop() { if (this.lifecycle === 'stopped') return; this.instance.dispose(); this.lifecycle = 'stopped'; }
}
