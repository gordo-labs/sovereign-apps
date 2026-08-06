export type BlePlatform = 'ios' | 'android' | 'macos' | 'windows' | 'linux' | 'unknown';
export type BleRole = 'central' | 'peripheral';
export type BleAvailabilityCode = 'available' | 'adapter_missing' | 'permission_denied' | 'bluetooth_off' | 'unsupported_role' | 'background_restricted' | 'unknown';

export interface BleAvailability { readonly available: boolean; readonly code: BleAvailabilityCode; readonly platform: BlePlatform; readonly role: BleRole; readonly detail: string; }
export interface BleAdvertisement { readonly ephemeralSessionId: string; readonly serviceUuid: string; readonly rssi?: number; readonly deviceHandle: string; }
export interface BleConnection { readonly deviceHandle: string; readonly mtu: number; write(value: Uint8Array): Promise<void>; onNotification(listener: (value: Uint8Array) => void): () => void; close(): Promise<void>; }
export interface BleAdapter {
  readonly platform: BlePlatform;
  readonly role: BleRole;
  availability(): Promise<BleAvailability>;
  requestPermission(): Promise<BleAvailability>;
  scan(signal?: AbortSignal): AsyncIterable<BleAdvertisement>;
  connect(advertisement: BleAdvertisement, signal?: AbortSignal): Promise<BleConnection>;
}

class FakeConnection implements BleConnection {
  private closed = false;
  private readonly listeners = new Set<(value: Uint8Array) => void>();
  readonly deviceHandle: string;
  readonly mtu: number;
  private readonly deliver: (value: Uint8Array) => void;
  constructor(deviceHandle: string, mtu: number, deliver: (value: Uint8Array) => void) {
    this.deviceHandle = deviceHandle;
    this.mtu = mtu;
    this.deliver = deliver;
  }
  async write(value: Uint8Array): Promise<void> {
    if (this.closed) throw new Error('BLE connection is closed');
    this.deliver(new Uint8Array(value));
  }
  onNotification(listener: (value: Uint8Array) => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  notify(value: Uint8Array): void { for (const listener of this.listeners) listener(new Uint8Array(value)); }
  async close(): Promise<void> { this.closed = true; this.listeners.clear(); }
}

/** Deterministic in-memory central/peripheral pair for conformance tests and host integration tests. */
export function createFakeBlePair(options: { mtu?: number } = {}): { central: BleAdapter; peripheral: BleAdapter; advertisement: BleAdvertisement } {
  const mtu = options.mtu ?? 185;
  const centralConnection = new FakeConnection('fake-peripheral', mtu, (value) => peripheralConnection.notify(value));
  const peripheralConnection = new FakeConnection('fake-central', mtu, (value) => centralConnection.notify(value));
  const availability = (platform: BlePlatform, role: BleRole): BleAvailability => ({ available: true, code: 'available', platform, role, detail: 'In-memory test adapter' });
  const advertisement: BleAdvertisement = { ephemeralSessionId: 'fake-session', serviceUuid: '6f766572-7365-7265-6967-6e2d626c65', deviceHandle: 'fake-peripheral' };
  const central: BleAdapter = {
    platform: 'unknown', role: 'central', availability: async () => availability('unknown', 'central'), requestPermission: async () => availability('unknown', 'central'),
    scan: async function* () { yield advertisement; }, connect: async (candidate) => { if (candidate.deviceHandle !== advertisement.deviceHandle) throw new Error('Unknown fake device'); return centralConnection; },
  };
  const peripheral: BleAdapter = {
    platform: 'unknown', role: 'peripheral', availability: async () => availability('unknown', 'peripheral'), requestPermission: async () => availability('unknown', 'peripheral'),
    scan: async function* () {}, connect: async () => peripheralConnection,
  };
  return { central, peripheral, advertisement };
}

export function unavailableAvailability(platform: BlePlatform, role: BleRole, code: Exclude<BleAvailabilityCode, 'available'> = 'adapter_missing'): BleAvailability {
  const detail = code === 'adapter_missing' ? 'No platform BLE adapter is bundled; install and inject one for this role.' : `BLE is unavailable: ${code}`;
  return { available: false, code, platform, role, detail };
}

/** Honest default: platform code must be supplied by the host app. */
export function createUnavailableAdapter(platform: BlePlatform, role: BleRole): BleAdapter {
  return {
    platform,
    role,
    availability: async () => unavailableAvailability(platform, role),
    requestPermission: async () => unavailableAvailability(platform, role),
    scan: async function* () { throw new Error('BLE adapter is not installed'); },
    connect: async () => { throw new Error('BLE adapter is not installed'); },
  };
}
