import type { Discovery, DiscoveryCandidate, ModuleContext } from '@sovereign-apps/module-kernel';
import {
  lanRecordToCandidate,
  LAN_SERVICE_DOMAIN,
  LAN_SERVICE_TYPE,
  parseLanTxt,
} from '@sovereign-apps/protocol';

export type ZeroconfService = {
  name?: string;
  port?: number;
  txt?: Readonly<Record<string, unknown>>;
  addresses?: readonly string[];
};
export type ZeroconfBrowser = {
  scan(type: string, domain: string): void;
  stop(): void;
  on(
    event: 'resolved' | 'removed' | 'error',
    listener: (service: ZeroconfService | Error) => void,
  ): () => void;
};

/** React Native browser adapter. Native permission is injected by the host app. */
export class ReactNativeLanDiscovery implements Discovery {
  readonly manifest = {
    id: 'discovery.lan-mdns.react-native',
    version: '1.0.0',
    kind: 'discovery' as const,
    platforms: ['ios', 'android'] as const,
    optional: true,
    capabilities: ['dns-sd-browse', 'lan-candidates'],
  };
  readonly availability = { available: true, platforms: ['ios', 'android'] as const };
  state: 'idle' | 'starting' | 'ready' | 'stopping' | 'stopped' | 'failed' = 'idle';
  private listeners: Array<() => void> = [];
  private readonly browser: ZeroconfBrowser;
  private readonly permission: () => Promise<'granted' | 'denied'>;
  private readonly peers = new Map<string, { candidate: DiscoveryCandidate; expiresAt: number }>();

  constructor(options: {
    browser: ZeroconfBrowser;
    requestPermission: () => Promise<'granted' | 'denied'>;
  }) {
    this.browser = options.browser;
    this.permission = options.requestPermission;
  }

  async start(_context: ModuleContext): Promise<void> {
    if (this.state === 'ready') return;
    this.state = 'starting';
    if ((await this.permission()) !== 'granted') {
      this.state = 'failed';
      throw new Error('LAN_PERMISSION_DENIED');
    }
    this.listeners.push(
      this.browser.on('resolved', (value) => {
        if (!(value instanceof Error)) this.accept(value);
      }),
    );
    this.listeners.push(
      this.browser.on('removed', (value) => {
        if (!(value instanceof Error)) this.remove(value);
      }),
    );
    this.listeners.push(this.browser.on('error', () => undefined));
    this.browser.scan(LAN_SERVICE_TYPE, LAN_SERVICE_DOMAIN);
    this.state = 'ready';
  }

  async *discover(
    options: { signal?: AbortSignal; timeoutMs?: number } = {},
  ): AsyncIterable<DiscoveryCandidate> {
    const queue: DiscoveryCandidate[] = [];
    let wake: (() => void) | undefined;
    const push = (candidate: DiscoveryCandidate) => {
      queue.push(candidate);
      wake?.();
    };
    const existing = [...this.peers.values()].map(({ candidate }) => candidate);
    existing.forEach(push);
    const unsubscribe = this.onCandidate(push);
    const deadline = Date.now() + (options.timeoutMs ?? 10_000);
    try {
      while (!options.signal?.aborted && Date.now() < deadline) {
        const next = queue.shift();
        if (next) {
          yield next;
          continue;
        }
        await new Promise<void>((resolve) => {
          wake = resolve;
          const timer = setTimeout(resolve, Math.max(0, deadline - Date.now()));
          options.signal?.addEventListener('abort', () => resolve(), { once: true });
          void timer;
        });
      }
    } finally {
      unsubscribe();
    }
  }

  async stop(): Promise<void> {
    if (this.state === 'stopped' || this.state === 'idle') {
      this.state = 'stopped';
      return;
    }
    this.state = 'stopping';
    this.browser.stop();
    this.listeners.splice(0).forEach((off) => off());
    this.peers.clear();
    this.state = 'stopped';
  }
  private callbacks = new Set<(candidate: DiscoveryCandidate) => void>();
  private onCandidate(callback: (candidate: DiscoveryCandidate) => void): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }
  private accept(service: ZeroconfService): void {
    const record = parseLanTxt(service.txt ?? {});
    if (!record) return;
    const candidate = lanRecordToCandidate(record);
    this.peers.set(record.nodeId, { candidate, expiresAt: Date.now() + 30_000 });
    this.callbacks.forEach((callback) => callback(candidate));
  }
  private remove(service: ZeroconfService): void {
    const record = parseLanTxt(service.txt ?? {});
    if (record) this.peers.delete(record.nodeId);
  }
}
