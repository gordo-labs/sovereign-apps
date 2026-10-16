import type {
  FramedStream,
  TransportCandidate,
  TransportEndpoint,
  TransportSession,
} from '@sovereign-apps/module-kernel';
import {
  DEFAULT_ALPN as PROTOCOL_DEFAULT_ALPN,
  NATIVE_TCP_STREAM_PREAMBLE,
  negotiateStreamHello,
} from '@sovereign-apps/protocol';
import type {
  BridgeLike,
  IrohBridgeConnection,
  IrohBridgeSession,
  IrohTcpForwarder,
} from './iroh-bridge.js';
import { getIrohBridge, bridgeDiagnostics } from './iroh-bridge.js';

export const RN_IROH_MODULE_ID = 'transport.iroh.react-native';
export const RN_IROH_VERSION = '0.2.0+';
export const DEFAULT_ALPN = PROTOCOL_DEFAULT_ALPN;
export const MAX_FRAME_BYTES = 2 * 1024 * 1024;

export type ReactNativeTransportState =
  'idle' | 'starting' | 'ready' | 'stopping' | 'stopped' | 'failed';

export class ReactNativeTransportError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'ReactNativeTransportError';
  }
}

type CandidateAddress = {
  target:
    | { kind: 'endpoint-ticket'; ticket: string }
    | {
        kind: 'endpoint-address';
        nodeId: string;
        directAddresses?: string[];
        relayUrl?: string | null;
      };
};

function isSocket(value: string): boolean {
  return /^(?:\[[0-9a-f:]+\]|[a-z0-9.-]+):\d{1,5}$/i.test(value);
}

function isRelay(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function normalizeAddress(raw: string): string {
  const value = raw.trim();
  if (!value) throw new ReactNativeTransportError('INVALID_ADDRESS', 'Candidate address is empty');
  if (value.startsWith('ip:')) return normalizeAddress(value.slice(3));
  if (value.startsWith('iroh+direct://'))
    return normalizeAddress(value.slice('iroh+direct://'.length));
  if (value.startsWith('relay:')) return normalizeAddress(value.slice('relay:'.length));
  if (value.startsWith('iroh+relay://'))
    return normalizeAddress(value.slice('iroh+relay://'.length));
  if (isSocket(value) || isRelay(value)) return value;
  if (value.startsWith('{') || value.startsWith('endpoint')) return value;
  throw new ReactNativeTransportError('INVALID_ADDRESS', 'Candidate address is not dialable');
}

/** Convert a kernel candidate into the typed target expected by npm 0.2.0. */
export function normalizeCandidate(
  candidate: TransportCandidate,
): CandidateAddress & { candidate: TransportCandidate } {
  if (!candidate.id.trim())
    throw new ReactNativeTransportError('INVALID_DIAL_TARGET', 'Candidate id is empty');
  const address = normalizeAddress(candidate.address);
  if (address.startsWith('endpoint')) {
    return { candidate, target: { kind: 'endpoint-ticket', ticket: address } };
  }
  if (address.startsWith('{')) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(address);
    } catch (error) {
      throw new ReactNativeTransportError('INVALID_TICKET', 'Candidate JSON ticket is malformed', {
        cause: error,
      });
    }
    if (!parsed || typeof parsed !== 'object')
      throw new ReactNativeTransportError(
        'INVALID_TICKET',
        'Candidate JSON ticket is not an object',
      );
    const value = parsed as { id?: unknown; addrs?: unknown; relay?: unknown };
    if (typeof value.id !== 'string' || value.id !== candidate.id) {
      throw new ReactNativeTransportError(
        'INVALID_DIAL_TARGET',
        'Ticket endpoint id does not match candidate id',
      );
    }
    if (
      !Array.isArray(value.addrs) ||
      value.addrs.length === 0 ||
      value.addrs.some((item) => typeof item !== 'string')
    ) {
      throw new ReactNativeTransportError('INVALID_TICKET', 'Ticket has no usable addresses');
    }
    const addresses = value.addrs.map(normalizeAddress);
    return {
      candidate,
      target: {
        kind: 'endpoint-address',
        nodeId: value.id,
        directAddresses: addresses.filter(isSocket),
        relayUrl:
          addresses.find(isRelay) ??
          (typeof value.relay === 'string' ? normalizeAddress(value.relay) : null),
      },
    };
  }
  return {
    candidate,
    target: {
      kind: 'endpoint-address',
      nodeId: candidate.id,
      directAddresses: isSocket(address) ? [address] : [],
      relayUrl: isRelay(address) ? address : null,
    },
  };
}

/**
 * Build the complete typed address target expected by recent bridge versions.
 * Passing direct addresses and the relay together lets Iroh perform path
 * selection and hole-punching inside one dial rather than restarting per hint.
 */
export function normalizeCandidates(
  candidates: readonly TransportCandidate[],
): CandidateAddress & { candidate: TransportCandidate } {
  if (candidates.length === 0)
    throw new ReactNativeTransportError(
      'INVALID_DIAL_TARGET',
      'At least one candidate is required',
    );
  const nodeIds = new Set(candidates.map((candidate) => candidate.id.trim()));
  if (nodeIds.size !== 1 || nodeIds.has(''))
    throw new ReactNativeTransportError(
      'INVALID_DIAL_TARGET',
      'All dial candidates must identify the same non-empty Iroh node',
    );

  const normalized = candidates.map(normalizeCandidate);
  const tickets = normalized.filter(
    (item): item is typeof item & { target: { kind: 'endpoint-ticket'; ticket: string } } =>
      item.target.kind === 'endpoint-ticket',
  );
  if (tickets.length > 1 && new Set(tickets.map((item) => item.target.ticket)).size > 1)
    throw new ReactNativeTransportError(
      'INVALID_DIAL_TARGET',
      'Multiple different endpoint tickets were provided for one peer',
    );
  if (tickets.length > 0) return tickets[0]!;

  const directAddresses = [
    ...new Set(
      normalized.flatMap((item) =>
        item.target.kind === 'endpoint-address' ? (item.target.directAddresses ?? []) : [],
      ),
    ),
  ];
  const relayUrls = [
    ...new Set(
      normalized.flatMap((item) => {
        if (item.target.kind !== 'endpoint-address' || !item.target.relayUrl) return [];
        return [item.target.relayUrl];
      }),
    ),
  ];
  const preferredRelay = [...candidates]
    .sort((left, right) => (right.priority ?? 0) - (left.priority ?? 0))
    .map((candidate) => normalizeCandidate(candidate))
    .find((item) => item.target.kind === 'endpoint-address' && Boolean(item.target.relayUrl));
  const relayUrl =
    preferredRelay?.target.kind === 'endpoint-address' ? preferredRelay.target.relayUrl : null;
  if (relayUrls.length > 1)
    throw new ReactNativeTransportError(
      'INVALID_DIAL_TARGET',
      'Multiple relay URLs cannot be represented by one Iroh endpoint target',
    );
  if (directAddresses.length === 0 && !relayUrl)
    throw new ReactNativeTransportError(
      'INVALID_DIAL_TARGET',
      'Candidates contain no usable direct address, relay URL, or endpoint ticket',
    );

  return {
    candidate: candidates[0]!,
    target: {
      kind: 'endpoint-address',
      nodeId: candidates[0]!.id.trim(),
      ...(directAddresses.length > 0 ? { directAddresses } : {}),
      relayUrl,
    },
  };
}

function raceAbort<T>(
  promise: Promise<T>,
  signal: AbortSignal | undefined,
  timeoutMs: number,
): Promise<T> {
  if (signal?.aborted)
    return Promise.reject(new ReactNativeTransportError('CANCELLED', 'Operation cancelled'));
  return new Promise<T>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const abort = () => {
      if (timer) clearTimeout(timer);
      reject(new ReactNativeTransportError('CANCELLED', 'Operation cancelled'));
    };
    signal?.addEventListener('abort', abort, { once: true });
    timer = setTimeout(
      () => reject(new ReactNativeTransportError('TIMEOUT', `Operation exceeded ${timeoutMs}ms`)),
      timeoutMs,
    );
    promise
      .then(resolve, (error) => reject(error))
      .finally(() => {
        if (timer) clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
      });
  });
}

class NativeFramedStream implements FramedStream {
  readonly id = `rn-stream-${Math.random().toString(36).slice(2)}`;
  private readonly frames: Uint8Array[] = [];
  private waiters: Array<(value: Uint8Array | null) => void> = [];
  private closed = false;
  private readonly unsubscribe: Array<() => void> = [];

  constructor(private readonly connection: IrohBridgeConnection) {
    this.unsubscribe.push(
      connection.onMessage((data) => {
        const frame = data instanceof Uint8Array ? data : Uint8Array.from(data);
        if (frame.byteLength === 0 || frame.byteLength > MAX_FRAME_BYTES)
          return this.closeSilently();
        const waiter = this.waiters.shift();
        if (waiter) waiter(frame);
        else this.frames.push(frame);
      }),
    );
    this.unsubscribe.push(connection.onClose(() => this.closeSilently()));
    this.unsubscribe.push(connection.onError(() => this.closeSilently()));
  }

  static async open(connection: IrohBridgeConnection, alpn: string): Promise<NativeFramedStream> {
    const stream = new NativeFramedStream(connection);
    try {
      await negotiateStreamHello(
        {
          read: () => stream.readRaw(),
          write: (data) => connection.send(data),
        },
        { alpn },
      );
      return stream;
    } catch (error) {
      await stream.close().catch(() => undefined);
      throw error;
    }
  }

  private async readRaw(): Promise<Uint8Array | null> {
    if (this.frames.length) return this.frames.shift()!;
    if (this.closed) return null;
    return new Promise<Uint8Array | null>((resolve) => this.waiters.push(resolve));
  }

  async read(options: { signal?: AbortSignal } = {}): Promise<Uint8Array | null> {
    if (this.frames.length) return this.frames.shift()!;
    if (this.closed) return null;
    return raceAbort(
      new Promise<Uint8Array | null>((resolve) => this.waiters.push(resolve)),
      options.signal,
      30_000,
    );
  }

  async write(frame: Uint8Array, options: { signal?: AbortSignal } = {}): Promise<void> {
    if (this.closed) throw new ReactNativeTransportError('CLOSED', 'Stream is closed');
    if (frame.byteLength === 0 || frame.byteLength > MAX_FRAME_BYTES)
      throw new ReactNativeTransportError('INVALID_FRAME', 'Frame must be 1..2MiB');
    await raceAbort(this.connection.send(frame), options.signal, 30_000);
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    for (const resolve of this.waiters.splice(0)) resolve(null);
    for (const unsubscribe of this.unsubscribe.splice(0)) unsubscribe();
    await this.connection.close();
  }

  private closeSilently(): void {
    if (this.closed) return;
    this.closed = true;
    for (const resolve of this.waiters.splice(0)) resolve(null);
    for (const unsubscribe of this.unsubscribe.splice(0)) unsubscribe();
  }
}

class NativeTransportSession implements TransportSession {
  readonly id = `rn-session-${Math.random().toString(36).slice(2)}`;
  private readonly streams = new Set<NativeFramedStream>();
  private closed = false;
  constructor(
    readonly candidate: TransportCandidate,
    private readonly session: IrohBridgeSession,
  ) {}
  async openStream(options: { signal?: AbortSignal } = {}): Promise<FramedStream> {
    if (this.closed) throw new ReactNativeTransportError('CLOSED', 'Session is closed');
    const connection = await raceAbort(this.session.openStream(), options.signal, 30_000);
    // NativeFramedStream.open performs the one stream-level hello. A second
    // hello here would be interpreted as application data by the peer.
    const stream = await NativeFramedStream.open(connection, DEFAULT_ALPN);
    this.streams.add(stream);
    return stream;
  }
  async close(reason?: string): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    await Promise.all([...this.streams].map((stream) => stream.close()));
    await this.session.close();
    void reason;
  }
}

export class ReactNativeIrohEndpoint implements TransportEndpoint {
  readonly manifest = {
    id: RN_IROH_MODULE_ID,
    version: RN_IROH_VERSION,
    kind: 'transport' as const,
    platforms: ['ios', 'android'] as const,
    capabilities: ['iroh-quic', 'outbound', 'framed-streams'],
  };
  readonly availability = { available: true, platforms: ['ios', 'android'] as const };
  state: ReactNativeTransportState = 'idle';
  private readonly bridge: BridgeLike;
  private readonly configured: readonly TransportCandidate[];
  private readonly forwarders = new Set<IrohTcpForwarder>();
  constructor(options: { bridge?: BridgeLike; candidates?: readonly TransportCandidate[] } = {}) {
    this.bridge = options.bridge ?? getIrohBridge();
    this.configured = options.candidates ?? [];
  }
  async start(context: { signal: AbortSignal }): Promise<void> {
    if (this.state === 'ready') return;
    if (this.state === 'starting')
      throw new ReactNativeTransportError('STARTING', 'Endpoint is already starting');
    this.state = 'starting';
    try {
      await raceAbort(this.bridge.start({ alpns: [DEFAULT_ALPN] }), context.signal, 15_000);
      this.state = 'ready';
    } catch (error) {
      this.state = 'failed';
      throw new ReactNativeTransportError(
        'NATIVE_UNAVAILABLE',
        'React Native Iroh native module failed to start',
        { cause: error },
      );
    }
  }
  async stop(): Promise<void> {
    if (this.state === 'stopped' || this.state === 'idle') {
      this.state = 'stopped';
      return;
    }
    this.state = 'stopping';
    try {
      await Promise.all([...this.forwarders].map((forwarder) => forwarder.stop()));
      this.forwarders.clear();
      await this.bridge.stop();
      this.state = 'stopped';
    } catch (error) {
      this.state = 'failed';
      throw new ReactNativeTransportError('STOP_FAILED', 'Failed to stop native Iroh endpoint', {
        cause: error,
      });
    }
  }
  async candidates(): Promise<readonly TransportCandidate[]> {
    return this.configured;
  }
  async accept(): Promise<TransportSession> {
    throw new ReactNativeTransportError(
      'OUTBOUND_ONLY',
      'React Native endpoint does not accept incoming sessions',
    );
  }
  async connect(
    candidate: TransportCandidate,
    options: { signal?: AbortSignal; timeoutMs?: number } = {},
  ): Promise<TransportSession> {
    if (this.state !== 'ready')
      throw new ReactNativeTransportError('NOT_READY', 'Start the endpoint before connecting');
    const compatibleCandidates = [
      candidate,
      ...this.configured.filter((item) => item.id === candidate.id && item !== candidate),
    ];
    const normalized = normalizeCandidates(compatibleCandidates);
    const call = this.bridge.openTargetSession({
      target: normalized.target,
      alpn: DEFAULT_ALPN,
      timeoutMs: options.timeoutMs ?? 4_500,
    });
    try {
      const session = await raceAbort(call, options.signal, options.timeoutMs ?? 4_500);
      return new NativeTransportSession(candidate, session);
    } catch (error) {
      throw new ReactNativeTransportError('DIAL_FAILED', 'Iroh dial failed', { cause: error });
    }
  }

  /**
   * Start the bridge 0.3 TCP-to-Iroh data plane for a peer that has already
   * completed the application pairing/grant flow. Bridge 0.2 remains usable
   * for framed messaging but intentionally cannot start this optional module.
   */
  async startTcpForwarder(candidate: TransportCandidate): Promise<IrohTcpForwarder> {
    if (this.state !== 'ready')
      throw new ReactNativeTransportError('NOT_READY', 'Start the endpoint before forwarding');
    const startForwarder = this.bridge.startTcpForwarder;
    if (!startForwarder)
      throw new ReactNativeTransportError(
        'UNSUPPORTED_NATIVE_API',
        'TCP forwarding requires @gordo-labs/react-native-iroh 0.3 or newer',
      );
    const normalized = normalizeCandidates([
      candidate,
      ...this.configured.filter((item) => item.id === candidate.id && item !== candidate),
    ]);
    const forwarder = await startForwarder({
      target: normalized.target,
      alpn: DEFAULT_ALPN,
      listenPort: 0,
      preamble: NATIVE_TCP_STREAM_PREAMBLE,
    });
    this.forwarders.add(forwarder);
    return forwarder;
  }
  async diagnostics(): Promise<{ packageVersion: string; nodeId: string; running: boolean }> {
    return bridgeDiagnostics(this.bridge);
  }
}
