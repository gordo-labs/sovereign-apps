import { Bonjour, type Service } from 'bonjour-service';
import type { ModuleContext, SovereignModule } from '@sovereign-apps/module-kernel';
import { defineManifest } from '@sovereign-apps/module-kernel';
import { encodeLanTxt, LAN_SERVICE_DOMAIN, LAN_SERVICE_TYPE, type LanDiscoveryRecord } from '@sovereign-apps/protocol';

export type LanAdvertisementSource = () => Omit<LanDiscoveryRecord, 'version'> & { version?: 1; servicePort?: number };

/** Electron Bonjour/DNS-SD advertiser. TXT data is deliberately bounded and non-secret. */
export class ElectronLanAdvertiser implements SovereignModule {
  readonly manifest = defineManifest({
    id: 'discovery.lan-mdns.electron', version: '1.0.0', kind: 'discovery' as const,
    platforms: ['electron'] as const, optional: true,
    capabilities: ['dns-sd-advertise', 'lan-candidates'],
  });
  readonly availability = { available: true, platforms: ['electron'] as const };
  state: 'idle' | 'starting' | 'ready' | 'stopping' | 'stopped' | 'failed' = 'idle';
  private bonjour: Bonjour | null = null;
  private service: Service | null = null;
  private readonly source: LanAdvertisementSource;

  constructor(options: { source: LanAdvertisementSource }) { this.source = options.source; }

  async start(_context: ModuleContext): Promise<void> {
    if (this.state === 'ready') return;
    this.state = 'starting';
    try {
      const source = this.source();
      const record = { ...source, version: 1 as const };
      const txt = encodeLanTxt(record);
      this.bonjour = new Bonjour();
      this.service = this.bonjour.publish({
        name: `${record.displayName ?? record.appId} (${record.nodeId.slice(0, 8)})`,
        type: LAN_SERVICE_TYPE.slice(1).replace('._tcp', ''),
        protocol: 'tcp',
        port: record.servicePort ?? 0,
        txt,
      });
      this.state = 'ready';
    } catch (error) {
      this.state = 'failed';
      await this.stop().catch(() => undefined);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (this.state === 'stopped' || this.state === 'idle') { this.state = 'stopped'; return; }
    this.state = 'stopping';
    this.service?.stop();
    this.service = null;
    this.bonjour?.destroy();
    this.bonjour = null;
    this.state = 'stopped';
  }

  /** Republishes TXT to rotate the ephemeral session reference after pairing. */
  async refresh(): Promise<void> {
    if (this.state !== 'ready') return;
    await this.stop();
    await this.start({ signal: new AbortController().signal, platform: 'electron', now: Date.now });
  }

  get running(): boolean { return this.service !== null; }
  get serviceDomain(): string { return LAN_SERVICE_DOMAIN; }
}
