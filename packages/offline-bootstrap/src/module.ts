import { defineManifest, type LifecycleState, type ModuleContext } from '@sovereign-apps/module-kernel';
import type { NfcAdapter } from './nfc.js';

export class OfflineBootstrapModule {
  readonly manifest = defineManifest({ id: 'bootstrap.offline', version: '0.0.1', kind: 'bootstrap' as const, capabilities: ['deep-link', 'file-share', 'nfc'], optional: true });
  readonly availability = { available: true, platforms: ['node', 'electron', 'ios', 'android', 'web'] as const };
  private lifecycle: LifecycleState = 'idle';
  constructor(readonly nfc?: NfcAdapter) {}
  get state(): LifecycleState { return this.lifecycle; }
  async start(_context: ModuleContext): Promise<void> { this.lifecycle = 'ready'; }
  async stop(): Promise<void> { this.lifecycle = 'stopped'; }
}
