const MAGIC = new Uint8Array([0x53, 0x41, 0x42, 0x31]); // SAB1
export const BLE_BOOTSTRAP_VERSION = 1 as const;
export const MAX_BOOTSTRAP_BYTES = 8 * 1024;
export const MAX_FRAGMENTS = 256;
export const MIN_ATT_MTU = 23;
export const DEFAULT_TIMEOUT_MS = 15_000;
const HEADER_BYTES = 56;

export type TransferId = Uint8Array;

export interface Fragment {
  readonly transferId: TransferId;
  readonly version: 1;
  readonly sequence: number;
  readonly totalFragments: number;
  readonly totalBytes: number;
  readonly digest: Uint8Array;
  readonly payload: Uint8Array;
  readonly wire: Uint8Array;
}

export interface FragmentOptions {
  readonly mtu?: number;
  readonly transferId?: Uint8Array;
}

function randomTransferId(): Uint8Array {
  const id = new Uint8Array(8);
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.getRandomValues) throw new Error('Secure random source is unavailable');
  cryptoApi.getRandomValues(id);
  return id;
}

async function sha256(input: Uint8Array): Promise<Uint8Array> {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.subtle) throw new Error('SHA-256 is unavailable in this runtime');
  const digest = await cryptoApi.subtle.digest('SHA-256', input as BufferSource);
  return new Uint8Array(digest);
}

function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function validateTransferId(id: Uint8Array): void {
  if (id.length !== 8) throw new RangeError('transferId must be exactly 8 bytes');
}

function encodeFragment(
  transferId: Uint8Array,
  sequence: number,
  totalFragments: number,
  totalBytes: number,
  digest: Uint8Array,
  payload: Uint8Array,
): Uint8Array {
  const wire = new Uint8Array(HEADER_BYTES + payload.length);
  wire.set(MAGIC, 0);
  wire[4] = BLE_BOOTSTRAP_VERSION;
  wire[5] = 0;
  wire.set(transferId, 6);
  const view = new DataView(wire.buffer);
  view.setUint16(14, sequence);
  view.setUint16(16, totalFragments);
  view.setUint32(18, totalBytes);
  view.setUint16(22, payload.length);
  wire.set(digest, 24);
  wire.set(payload, HEADER_BYTES);
  return wire;
}

export async function fragmentBootstrap(payload: Uint8Array, options: FragmentOptions = {}): Promise<readonly Fragment[]> {
  if (!(payload instanceof Uint8Array)) throw new TypeError('payload must be Uint8Array');
  if (payload.length > MAX_BOOTSTRAP_BYTES) throw new RangeError(`bootstrap exceeds ${MAX_BOOTSTRAP_BYTES} bytes`);
  const mtu = options.mtu ?? 185;
  if (!Number.isInteger(mtu) || mtu < MIN_ATT_MTU) throw new RangeError(`mtu must be at least ${MIN_ATT_MTU}`);
  const chunkBytes = Math.min(512, mtu - 3);
  const totalFragments = Math.max(1, Math.ceil(payload.length / chunkBytes));
  if (totalFragments > MAX_FRAGMENTS) throw new RangeError(`bootstrap exceeds ${MAX_FRAGMENTS} fragments`);
  const transferId = options.transferId ? new Uint8Array(options.transferId) : randomTransferId();
  validateTransferId(transferId);
  const digest = await sha256(payload);
  const fragments: Fragment[] = [];
  for (let sequence = 0; sequence < totalFragments; sequence += 1) {
    const start = sequence * chunkBytes;
    const part = payload.slice(start, Math.min(payload.length, start + chunkBytes));
    const wire = encodeFragment(transferId, sequence, totalFragments, payload.length, digest, part);
    fragments.push({ transferId: new Uint8Array(transferId), version: 1, sequence, totalFragments, totalBytes: payload.length, digest: new Uint8Array(digest), payload: part, wire });
  }
  return fragments;
}

export function decodeFragment(wire: Uint8Array): Fragment {
  if (!(wire instanceof Uint8Array) || wire.length < HEADER_BYTES) throw new Error('BLE fragment is truncated');
  if (!MAGIC.every((value, index) => wire[index] === value)) throw new Error('BLE fragment magic mismatch');
  if (wire[4] !== BLE_BOOTSTRAP_VERSION) throw new Error('Unsupported BLE bootstrap version');
  const view = new DataView(wire.buffer, wire.byteOffset, wire.byteLength);
  const transferId = wire.slice(6, 14);
  const sequence = view.getUint16(14);
  const totalFragments = view.getUint16(16);
  const totalBytes = view.getUint32(18);
  const payloadBytes = view.getUint16(22);
  const digest = wire.slice(24, 56);
  if (totalFragments < 1 || totalFragments > MAX_FRAGMENTS || sequence >= totalFragments) throw new Error('Invalid BLE fragment sequence');
  if (totalBytes > MAX_BOOTSTRAP_BYTES || payloadBytes !== wire.length - HEADER_BYTES) throw new Error('Invalid BLE fragment size');
  if (totalFragments === 1 && totalBytes !== payloadBytes) throw new Error('Invalid single-fragment size');
  if (totalFragments > 1 && payloadBytes === 0) throw new Error('Empty non-terminal BLE fragment');
  return { transferId, version: 1, sequence, totalFragments, totalBytes, digest, payload: wire.slice(HEADER_BYTES), wire: new Uint8Array(wire) };
}

export async function reassembleBootstrap(fragments: readonly (Fragment | Uint8Array)[]): Promise<Uint8Array> {
  if (fragments.length === 0 || fragments.length > MAX_FRAGMENTS) throw new Error('No valid BLE fragments');
  const decoded = fragments.map((fragment) => fragment instanceof Uint8Array ? decodeFragment(fragment) : fragment);
  const first = decoded[0];
  const bySequence = new Map<number, Fragment>();
  for (const fragment of decoded) {
    if (!equalBytes(fragment.transferId, first.transferId) || fragment.totalFragments !== first.totalFragments || fragment.totalBytes !== first.totalBytes || !equalBytes(fragment.digest, first.digest)) throw new Error('BLE fragments belong to different transfers');
    const existing = bySequence.get(fragment.sequence);
    if (existing && !equalBytes(existing.payload, fragment.payload)) throw new Error('Conflicting duplicate BLE fragment');
    bySequence.set(fragment.sequence, fragment);
  }
  if (bySequence.size !== first.totalFragments) throw new Error('BLE transfer is incomplete');
  const result = new Uint8Array(first.totalBytes);
  let offset = 0;
  for (let sequence = 0; sequence < first.totalFragments; sequence += 1) {
    const fragment = bySequence.get(sequence);
    if (!fragment) throw new Error('BLE transfer is missing a fragment');
    result.set(fragment.payload, offset);
    offset += fragment.payload.length;
  }
  if (offset !== first.totalBytes || !equalBytes(await sha256(result), first.digest)) throw new Error('BLE bootstrap integrity check failed');
  return result;
}

export class ReassemblySession {
  private readonly fragments: Fragment[] = [];
  private deadline: number;
  private cancelled = false;
  private completed = false;
  readonly timeoutMs: number;
  private readonly now: () => number;
  constructor(timeoutMs = DEFAULT_TIMEOUT_MS, now = () => Date.now()) {
    this.timeoutMs = timeoutMs;
    this.now = now;
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new RangeError('timeoutMs must be positive');
    this.deadline = this.now() + timeoutMs;
  }
  push(fragment: Fragment | Uint8Array): void {
    if (this.cancelled) throw new Error('BLE reassembly cancelled');
    if (this.completed) throw new Error('BLE reassembly already completed');
    if (this.now() > this.deadline) throw new Error('BLE reassembly timed out');
    this.fragments.push(fragment instanceof Uint8Array ? decodeFragment(fragment) : fragment);
  }
  async finish(): Promise<Uint8Array> {
    if (this.now() > this.deadline) throw new Error('BLE reassembly timed out');
    const result = await reassembleBootstrap(this.fragments);
    this.completed = true;
    return result;
  }
  cancel(): void { this.cancelled = true; this.fragments.length = 0; }
  get isCancelled(): boolean { return this.cancelled; }
}
