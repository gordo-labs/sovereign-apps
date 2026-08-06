import { ModuleCompositionError, ModuleUnavailableError } from './errors.js';
import type { ModuleContext, ModuleId, ModuleManifest, Platform, SovereignModule } from './types.js';

export interface Composition { readonly modules: readonly SovereignModule[]; readonly optionalFailures: readonly string[]; }
export interface CompositionResult { readonly composition: Composition; readonly errors: ModuleCompositionError[]; }

export class ModuleRegistry {
  private readonly modules = new Map<ModuleId, SovereignModule>();
  register(module: SovereignModule): void {
    if (this.modules.has(module.manifest.id)) throw new ModuleCompositionError(`Duplicate module id: ${module.manifest.id}`);
    this.modules.set(module.manifest.id, module);
  }
  get(id: ModuleId): SovereignModule | undefined { return this.modules.get(id); }
  validate(selected: readonly ModuleId[], platform: Platform, config: Readonly<Record<string, unknown>> = {}): CompositionResult {
    const errors: ModuleCompositionError[] = [];
    const chosen = selected.map((id) => this.modules.get(id));
    for (const [index, module] of chosen.entries()) {
      const id = selected[index];
      if (!module) { errors.push(new ModuleCompositionError(`Unknown module: ${id}`, { moduleId: id })); continue; }
      const manifest = module.manifest;
      if (manifest.platforms && !manifest.platforms.includes(platform)) errors.push(new ModuleCompositionError(`Module ${id} does not support platform ${platform}`, { moduleId: id, platform }));
      if (!module.availability.available && !manifest.optional) errors.push(new ModuleUnavailableError(id, module.availability.reason));
      for (const dependency of manifest.dependencies ?? []) if (!selected.includes(dependency)) errors.push(new ModuleCompositionError(`Module ${id} requires ${dependency}`, { moduleId: id, dependency }));
      for (const conflict of manifest.conflicts ?? []) if (selected.includes(conflict)) errors.push(new ModuleCompositionError(`Module ${id} conflicts with ${conflict}`, { moduleId: id, conflict }));
      for (const field of manifest.configSchema ?? []) if (field.required && config[field.name] === undefined) errors.push(new ModuleCompositionError(`Module ${id} requires config.${field.name}`, { moduleId: id, field: field.name }));
    }
    const optionalFailures = chosen.filter((m): m is SovereignModule => !!m && (!m.availability.available || Boolean(m.manifest.platforms && !m.manifest.platforms.includes(platform)))).filter((m) => m.manifest.optional).map((m) => m.manifest.id);
    return { composition: { modules: chosen.filter((m): m is SovereignModule => !!m && !optionalFailures.includes(m.manifest.id)), optionalFailures }, errors };
  }
  async start(selected: readonly ModuleId[], context: ModuleContext, config: Readonly<Record<string, unknown>> = {}): Promise<Composition> {
    const result = this.validate(selected, context.platform, config);
    if (result.errors.length) throw new ModuleCompositionError(result.errors.map((e) => e.message).join('; '), { errors: result.errors.map((e) => e.details) });
    const started: SovereignModule[] = [];
    const optionalFailures = [...result.composition.optionalFailures];
    const ordered = this.order(result.composition.modules);
    try {
      for (const module of ordered) {
        try { await module.start(context); started.push(module); }
        catch (error) {
          if (!module.manifest.optional) throw error;
          await module.stop().catch(() => undefined);
          optionalFailures.push(module.manifest.id);
          context.diagnostics?.emit({ name: 'module_start_failed', at: new Date(context.now()).toISOString(), module: module.manifest.id, outcome: 'error', fields: { optional: true, error: error instanceof Error ? error.message : String(error) } });
        }
      }
      return { modules: started, optionalFailures };
    } catch (error) {
      await Promise.allSettled(started.reverse().map((module) => module.stop()));
      throw error;
    }
  }
  private order(modules: readonly SovereignModule[]): SovereignModule[] {
    const selected = new Map(modules.map((module) => [module.manifest.id, module]));
    const ordered: SovereignModule[] = []; const visiting = new Set<string>(); const visited = new Set<string>();
    const visit = (module: SovereignModule): void => {
      if (visited.has(module.manifest.id)) return;
      if (visiting.has(module.manifest.id)) throw new ModuleCompositionError(`Dependency cycle at ${module.manifest.id}`);
      visiting.add(module.manifest.id);
      for (const dependency of module.manifest.dependencies ?? []) { const dependencyModule = selected.get(dependency); if (dependencyModule) visit(dependencyModule); }
      visiting.delete(module.manifest.id); visited.add(module.manifest.id); ordered.push(module);
    };
    modules.forEach(visit); return ordered;
  }
  async stop(composition: Composition): Promise<void> { for (const module of [...composition.modules].reverse()) await module.stop(); }
}

export function defineManifest(manifest: ModuleManifest): ModuleManifest { return Object.freeze({ ...manifest, dependencies: Object.freeze([...(manifest.dependencies ?? [])]), conflicts: Object.freeze([...(manifest.conflicts ?? [])]), capabilities: Object.freeze([...(manifest.capabilities ?? [])]) }); }
