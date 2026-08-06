import { DEFAULT_TIMEOUT_MS, fragmentBootstrap, ReassemblySession, reassembleBootstrap, type FragmentOptions } from './fragmentation.js';
import type { BleAdapter, BleAdvertisement, BleAvailability, BleConnection } from './adapters.js';

export const BLE_SERVICE_UUID = '6f766572-7365-7265-6967-6e2d626c65';
export const BLE_BOOTSTRAP_WRITE_UUID = '6f766572-7365-7265-6967-6e2d777274';
export const BLE_BOOTSTRAP_NOTIFY_UUID = '6f766572-7365-7265-6967-6e2d6e6f74';

export interface BleBootstrapOptions extends FragmentOptions { readonly timeoutMs?: number; readonly now?: () => number; }
export interface BleBootstrapTransport { readonly availability: BleAvailability; transfer(advertisement: BleAdvertisement, payload: Uint8Array, options?: BleBootstrapOptions): Promise<Uint8Array>; }

/** Transport-only helper. The payload must already be the authenticated SA-002/SA-005 bootstrap envelope. */
export class BleBootstrapSession implements BleBootstrapTransport {
  private readonly adapter: BleAdapter;
  constructor(adapter: BleAdapter) { this.adapter = adapter; }
  async getAvailability(): Promise<BleAvailability> { return this.adapter.availability(); }
  get availability(): BleAvailability { return { available: false, code: 'unknown', platform: this.adapter.platform, role: this.adapter.role, detail: 'Call getAvailability() before use.' }; }
  async transfer(advertisement: BleAdvertisement, payload: Uint8Array, options: BleBootstrapOptions = {}): Promise<Uint8Array> {
    const availability = await this.adapter.availability();
    if (!availability.available) throw new Error(`BLE unavailable (${availability.code}): ${availability.detail}`);
    const connection = await this.adapter.connect(advertisement);
    try {
      const fragments = await fragmentBootstrap(payload, options);
      for (const fragment of fragments) await connection.write(fragment.wire);
      return reassembleBootstrap(fragments);
    } finally { await connection.close().catch(() => undefined); }
  }
}

export async function receiveBootstrap(connection: BleConnection, options: { timeoutMs?: number; now?: () => number; signal?: AbortSignal } = {}): Promise<Uint8Array> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const session = new ReassemblySession(timeoutMs, options.now);
  return new Promise<Uint8Array>((resolve, reject) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      unsubscribe();
      options.signal?.removeEventListener('abort', abort);
      fn();
    };
    const unsubscribe = connection.onNotification((value) => {
      try {
        session.push(value);
        void session.finish().then((result) => finish(() => resolve(result))).catch(() => undefined);
      } catch (error) { finish(() => reject(error)); }
    });
    const abort = () => { session.cancel(); finish(() => reject(new Error('BLE bootstrap cancelled'))); };
    options.signal?.addEventListener('abort', abort, { once: true });
    timer = setTimeout(() => { session.cancel(); finish(() => reject(new Error('BLE bootstrap timed out'))); }, timeoutMs);
  });
}
