/**
 * Minimal Iroh node wrapper for Electron apps.
 *
 * Uses @momics/iroh-http-node — the same native NAPI-RS module as Music Hub's
 * sovereign responder. Falls back to null when unavailable (testing, Docker).
 */

export interface IrohDuplexConnection {
  peerId?: string;
  send(data: Uint8Array): Promise<void> | void;
  onMessage(handler: (data: Uint8Array) => void): (() => void) | void;
  onClose?(handler: () => void): (() => void) | void;
  close(): Promise<void> | void;
}

export interface IrohDialOptions {
  directAddrs?: string[];
  relayUrl?: string;
}

export interface IrohDialSession {
  remoteId?: { toString(): string } | string;
  closed?: Promise<unknown>;
  createBidirectionalStream(): Promise<{
    readable: ReadableStream<Uint8Array>;
    writable: WritableStream<Uint8Array>;
  }>;
  close(closeInfo?: { closeCode: number; reason: string }): void;
}

export interface IrohNode {
  nodeId: string;
  ticket?: string | null;
  addrs?: string[];
  serveSessions?(handler: (connection: IrohDuplexConnection) => void | Promise<void>): Promise<void>;
  dial?(nodeId: string, options?: IrohDialOptions): Promise<IrohDialSession>;
  close(): Promise<void>;
}

export async function createIrohNode(key: Uint8Array): Promise<IrohNode> {
  let mod: typeof import('@momics/iroh-http-node') | undefined;
  try {
    mod = await import('@momics/iroh-http-node');
  } catch {
    console.warn('[iroh-node] @momics/iroh-http-node unavailable — using stub');
    return createStubNode();
  }
  return createRealNode(mod, key);
}

async function createRealNode(
  irohMod: typeof import('@momics/iroh-http-node'),
  key: Uint8Array,
): Promise<IrohNode> {
  const endpoint = await irohMod.createEndpoint({
    secretKey: key,
    relayMode: 'default',
  });

  const nodeId = await endpoint.nodeId();
  const ticket = await endpoint.ticket();
  const addrs = await endpoint.directAddresses();

  return {
    nodeId,
    ticket,
    addrs,
    async serveSessions(
      handler: (connection: IrohDuplexConnection) => void | Promise<void>,
    ): Promise<void> {
      await endpoint.serveConnections(async (conn: unknown) => {
        const irohConn = conn as any;
        const connection: IrohDuplexConnection = {
          peerId: String(irohConn.remoteId?.() ?? ''),
          send(data: Uint8Array): void {
            irohConn.send?.(data);
          },
          onMessage(handler: (data: Uint8Array) => void): (() => void) {
            const off = irohConn.onMessage?.((msg: Uint8Array) => handler(msg));
            return off ?? (() => {});
          },
          close(): Promise<void> {
            irohConn.close?.();
            return Promise.resolve();
          },
        };
        await handler(connection);
      });
    },
    async dial(nodeId: string, options?: IrohDialOptions): Promise<IrohDialSession> {
      const directAddrs = options?.directAddrs?.slice(0, 8);
      const relayUrl = options?.relayUrl ?? undefined;
      const session = await endpoint.connect(nodeId, {
        directAddrs,
        relayUrl: relayUrl ? { url: relayUrl } : undefined,
      });
      return {
        remoteId: session.remoteId?.() ?? nodeId,
        async createBidirectionalStream() {
          const { readable, writable } = await session.createStream();
          return { readable, writable };
        },
        close(info) {
          session.close(info?.closeCode ?? 0, info?.reason ?? 'closed');
        },
      };
    },
    async close(): Promise<void> {
      await endpoint.close();
    },
  };
}

function createStubNode(): IrohNode {
  const stubId = 'stub-node-id-000000000000';
  return {
    nodeId: stubId,
    ticket: null,
    addrs: [],
    async serveSessions(): Promise<void> {},
    async dial(): Promise<IrohDialSession> {
      throw new Error('Iroh native module not available');
    },
    async close(): Promise<void> {},
  };
}
