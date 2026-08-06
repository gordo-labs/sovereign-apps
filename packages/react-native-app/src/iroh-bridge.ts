/**
 * Iroh bridge interface for React Native.
 *
 * Wraps @gordo-labs/react-native-iroh (UniFFI + TurboModule bridge).
 * Same API surface as iroh-react-native-bridge/rust/iroh_mobile_bridge.
 */

export interface IrohSession {
  send(data: Uint8Array): Promise<void>;
  onMessage(handler: (data: Uint8Array) => void): void;
  onClose(handler: () => void): void;
  close(): Promise<void>;
}

export interface IrohBridge {
  startEndpoint(relayUrl?: string): Promise<void>;
  stopEndpoint(): Promise<void>;
  getNodeId(): string | null;
  dial(nodeId: string, relayUrl?: string): Promise<IrohSession>;
}

export function getIrohBridge(): IrohBridge {
  let nativeBridge: any = null;
  try {
    // Dynamic import of the native package
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    nativeBridge = require('@gordo-labs/react-native-iroh');
  } catch {
    console.warn('[iroh-bridge] @gordo-labs/react-native-iroh unavailable — using stub');
    return createStubBridge();
  }
  return createNativeBridge(nativeBridge.getIrohBridge());
}

function createNativeBridge(native: any): IrohBridge {
  return {
    async startEndpoint(relayUrl?: string): Promise<void> {
      await native.startEndpoint(relayUrl ?? undefined);
    },
    async stopEndpoint(): Promise<void> {
      await native.stopEndpoint();
    },
    getNodeId(): string | null {
      return native.getNodeId() ?? null;
    },
    async dial(nodeId: string, relayUrl?: string): Promise<IrohSession> {
      const session = await native.dial(nodeId, relayUrl);
      return {
        async send(data: Uint8Array): Promise<void> {
          await session.send(data);
        },
        onMessage(handler: (data: Uint8Array) => void): void {
          session.onMessage((msg: Uint8Array) => handler(msg));
        },
        onClose(handler: () => void): void {
          session.onClose(() => handler());
        },
        async close(): Promise<void> {
          await session.close();
        },
      };
    },
  };
}

function createStubBridge(): IrohBridge {
  return {
    async startEndpoint(): Promise<void> {
      console.log('[iroh-bridge] Stub: endpoint started (no native module)');
    },
    async stopEndpoint(): Promise<void> {},
    getNodeId(): string | null {
      return 'stub-rn-node-id-000000';
    },
    async dial(_nodeId: string): Promise<IrohSession> {
      return {
        async send(_data: Uint8Array): Promise<void> {},
        onMessage(_handler: (data: Uint8Array) => void): void {},
        onClose(_handler: () => void): void {},
        async close(): Promise<void> {},
      };
    },
  };
}
