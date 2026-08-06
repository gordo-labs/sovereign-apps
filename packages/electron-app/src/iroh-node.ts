import type { IrohNode as NativeIrohNode } from '@momics/iroh-http-node';
import { createNode } from '@momics/iroh-http-node';
import {
  DEFAULT_ALPN,
  FrameDecoder,
  encodeFrame,
  MAX_FRAME_BYTES,
  type IrohDialOptions,
} from '@sovereign-apps/protocol';

export type EndpointState = 'starting' | 'ready' | 'unavailable' | 'error' | 'closed';

export type IrohCandidate =
  { kind: 'direct'; address: string } | { kind: 'relay'; address: string };

export interface IrohDuplexConnection {
  readonly peerId: string;
  send(data: Uint8Array): Promise<void>;
  onMessage(handler: (data: Uint8Array) => void): () => void;
  onClose(handler: (error?: Error) => void): () => void;
  close(): Promise<void>;
}

export interface IrohDialSession {
  readonly remoteId: string;
  createBidirectionalStream(): Promise<{
    readable: ReadableStream<Uint8Array>;
    writable: WritableStream<Uint8Array>;
  }>;
  close(closeInfo?: { closeCode: number; reason: string }): void;
}

export interface IrohNode {
  readonly nodeId: string;
  readonly ticket: string | null;
  readonly state: EndpointState;
  readonly lastError?: string;
  readonly candidates: readonly IrohCandidate[];
  serveSessions(handler: (connection: IrohDuplexConnection) => void | Promise<void>): Promise<void>;
  dial(
    nodeId: string,
    options?: IrohDialOptions & { timeoutMs?: number },
  ): Promise<IrohDialSession>;
  refreshAddressInfo(): Promise<readonly IrohCandidate[]>;
  close(): Promise<void>;
}

export type CreateIrohNodeOptions = {
  key: Uint8Array;
  alpn?: string;
  relayMode?: 'default' | 'staging' | 'disabled' | string;
  maxSessions?: number;
  maxFrameBytes?: number;
  dialTimeoutMs?: number;
  nativeFactory?: (options: {
    key: Uint8Array;
    relay?: { mode: string };
  }) => Promise<NativeIrohNode>;
};

const MAX_SESSIONS = 50;
const DIAL_TIMEOUT_MS = 10_000;
type NativeSession = Awaited<ReturnType<NativeIrohNode['dial']>>;

/**
 * Neutral Electron adapter over the actual high-level @momics API.
 * It owns one endpoint, frames every raw stream with SA-002, and never
 * silently replaces a missing native runtime with a fake production node.
 */
export class ElectronIrohNode implements IrohNode {
  readonly nodeId: string;
  ticket: string | null = null;
  state: EndpointState = 'starting';
  lastError?: string;
  private candidatesValue: IrohCandidate[] = [];
  private readonly abortController = new AbortController();
  private readonly sessions = new Set<IrohDuplexConnection>();
  private accepting?: Promise<void>;
  private closed = false;
  private readonly maxSessions: number;
  private readonly maxFrameBytes: number;
  private readonly dialTimeoutMs: number;

  private constructor(
    private readonly native: NativeIrohNode,
    private readonly alpn: string,
    options: CreateIrohNodeOptions,
  ) {
    this.nodeId = native.publicKey.toString();
    this.maxSessions = options.maxSessions ?? MAX_SESSIONS;
    this.maxFrameBytes = options.maxFrameBytes ?? MAX_FRAME_BYTES;
    this.dialTimeoutMs = options.dialTimeoutMs ?? DIAL_TIMEOUT_MS;
  }

  static async create(options: CreateIrohNodeOptions): Promise<ElectronIrohNode> {
    if (options.key.byteLength !== 32) throw new Error('Iroh secret key must be exactly 32 bytes');
    try {
      const factory = options.nativeFactory ?? ((config) => createNode(config));
      const native = await factory({
        key: options.key.slice(),
        relay: { mode: options.relayMode ?? 'default' },
      });
      const adapter = new ElectronIrohNode(native, options.alpn ?? DEFAULT_ALPN, options);
      await adapter.refreshAddressInfo();
      adapter.state = 'ready';
      return adapter;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new IrohRuntimeError('unavailable', `Iroh native runtime unavailable: ${message}`);
    }
  }

  get candidates(): readonly IrohCandidate[] {
    return this.candidatesValue;
  }

  async refreshAddressInfo(): Promise<readonly IrohCandidate[]> {
    this.ensureOpen();
    const info = await this.native.discoveryInfo();
    this.ticket = await this.native.ticket();
    const direct = (info.directAddresses ?? []).filter((address) => isDirectAddress(address));
    const candidates: IrohCandidate[] = [];
    if (direct.length > 0)
      candidates.push({
        kind: 'direct',
        address: JSON.stringify({ id: this.nodeId, addrs: direct }),
      });
    if (info.relayUrl && isRelayUrl(info.relayUrl))
      candidates.push({ kind: 'relay', address: info.relayUrl });
    this.candidatesValue = candidates;
    return candidates;
  }

  async serveSessions(
    handler: (connection: IrohDuplexConnection) => void | Promise<void>,
  ): Promise<void> {
    if (this.accepting) return this.accepting;
    this.ensureOpen();
    this.accepting = (async () => {
      try {
        for await (const session of this.native.incoming({ signal: this.abortController.signal })) {
          if (this.closed) break;
          if (this.sessions.size >= this.maxSessions) {
            session.close({ closeCode: 429, reason: 'session limit reached' });
            continue;
          }
          const connection = await FramedIrohConnection.open(
            session,
            this.maxFrameBytes,
            this.alpn,
          );
          this.sessions.add(connection);
          connection.onClose(() => this.sessions.delete(connection));
          try {
            await handler(connection);
          } catch (error) {
            await connection.close().catch(() => undefined);
            this.lastError = error instanceof Error ? error.message : String(error);
          }
        }
      } catch (error) {
        if (!this.closed) {
          this.state = 'error';
          this.lastError = error instanceof Error ? error.message : String(error);
        }
      }
    })();
    return this.accepting;
  }

  async dial(
    nodeId: string,
    options: IrohDialOptions & { timeoutMs?: number } = {},
  ): Promise<IrohDialSession> {
    this.ensureOpen();
    const timeoutMs = options.timeoutMs ?? this.dialTimeoutMs;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let timedOut = false;
    try {
      const pending = this.native.dial(nodeId, {
        directAddrs: options.directAddrs,
        relayUrl: options.relayUrl,
      });
      const session = await Promise.race([
        pending,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            timedOut = true;
            reject(new IrohRuntimeError('error', `Iroh dial timed out after ${timeoutMs}ms`));
          }, timeoutMs);
        }),
      ]);
      if (timedOut) {
        session.close({ closeCode: 408, reason: 'dial timeout' });
        throw new IrohRuntimeError('error', 'Iroh dial completed after timeout');
      }
      return {
        remoteId: session.remoteId.toString(),
        createBidirectionalStream: () => session.createBidirectionalStream(),
        close: (info?: { closeCode: number; reason: string }) => session.close(info),
      };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    this.state = 'closed';
    this.abortController.abort();
    await Promise.all(
      [...this.sessions].map((connection) => connection.close().catch(() => undefined)),
    );
    await this.native.close({ force: true });
    this.sessions.clear();
  }

  private ensureOpen(): void {
    if (this.closed || this.state === 'closed')
      throw new IrohRuntimeError('closed', 'Iroh endpoint is closed');
  }
}

class FramedIrohConnection implements IrohDuplexConnection {
  readonly peerId: string;
  private readonly handlers = new Set<(data: Uint8Array) => void>();
  private readonly closeHandlers = new Set<(error?: Error) => void>();
  private readonly decoder: FrameDecoder;
  private readonly maxFrameBytes: number;
  private readonly reader: ReadableStreamDefaultReader<Uint8Array>;
  private readonly writer: WritableStreamDefaultWriter<Uint8Array>;
  private writeChain = Promise.resolve();
  private closed = false;

  private constructor(
    private readonly session: NativeSession,
    maxFrameBytes: number,
    _alpn: string,
    stream: { readable: ReadableStream<Uint8Array>; writable: WritableStream<Uint8Array> },
  ) {
    this.peerId = session.remoteId.toString();
    this.decoder = new FrameDecoder({ maxFrameBytes });
    this.maxFrameBytes = maxFrameBytes;
    this.reader = stream.readable.getReader();
    this.writer = stream.writable.getWriter();
    void this.readLoop();
    void session.closed
      .then(() => this.markClosed())
      .catch((error) => this.markClosed(asError(error)));
  }

  static async open(
    session: NativeSession,
    maxFrameBytes: number,
    alpn: string,
  ): Promise<FramedIrohConnection> {
    await session.ready;
    return new FramedIrohConnection(
      session,
      maxFrameBytes,
      alpn,
      await session.createBidirectionalStream(),
    );
  }

  send(data: Uint8Array): Promise<void> {
    if (this.closed) return Promise.reject(new Error('Iroh connection is closed'));
    const frame = encodeFrame(data, this.maxFrameBytes);
    this.writeChain = this.writeChain.then(() => this.writer.write(frame));
    return this.writeChain;
  }

  onMessage(handler: (data: Uint8Array) => void): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  onClose(handler: (error?: Error) => void): () => void {
    this.closeHandlers.add(handler);
    return () => this.closeHandlers.delete(handler);
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.markClosed();
    await this.writeChain.catch(() => undefined);
    await this.writer.close().catch(() => undefined);
    await this.reader.cancel().catch(() => undefined);
    this.session.close({ closeCode: 0, reason: 'closed' });
  }

  private async readLoop(): Promise<void> {
    try {
      while (!this.closed) {
        const { value, done } = await this.reader.read();
        if (done) break;
        for (const frame of this.decoder.push(value ?? new Uint8Array())) {
          for (const handler of this.handlers) handler(frame);
        }
      }
      this.decoder.finish();
    } catch (error) {
      this.markClosed(asError(error));
    }
    this.markClosed();
  }

  private markClosed(error?: Error): void {
    if (this.closed) return;
    this.closed = true;
    for (const handler of this.closeHandlers) handler(error);
    this.handlers.clear();
    this.closeHandlers.clear();
  }
}

export class IrohRuntimeError extends Error {
  constructor(
    readonly state: Exclude<EndpointState, 'starting' | 'ready'>,
    message: string,
  ) {
    super(message);
    this.name = 'IrohRuntimeError';
  }
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function isDirectAddress(value: string): boolean {
  return /^\[[0-9a-f:.]+\](?::\d+)$|^[A-Za-z0-9.-]+:\d+$/.test(value.trim());
}

function isRelayUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

export async function createIrohNode(options: CreateIrohNodeOptions): Promise<IrohNode> {
  return ElectronIrohNode.create(options);
}
