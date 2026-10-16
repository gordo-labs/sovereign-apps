/**
 * Narrow, injectable wrapper around the published React Native bridge.
 *
 * The npm bridge owns Iroh endpoint/session/stream lifecycles. This package
 * deliberately does not emulate native networking: when the TurboModule is
 * absent, start/connect reject and the caller can surface a diagnostic state.
 */
import {
  getIrohBridge as getPublishedIrohBridge,
  IrohBridgeError,
  type IrohBridge as PublishedIrohBridge,
  type IrohBridgeConnection,
  type IrohBridgeSession,
  type IrohConnectTargetOptions,
  type IrohStartOptions,
} from '@gordo-labs/react-native-iroh';

export type { IrohBridgeConnection, IrohBridgeSession, IrohConnectTargetOptions, IrohStartOptions };
export { IrohBridgeError };

export type IrohTcpForwarder = {
  readonly id: string;
  readonly port: number;
  stats(): {
    activeConnections: number;
    totalConnections: number;
    failedStreams: number;
    bytesUp: number;
    bytesDown: number;
    activeDownMs: number;
  };
  stop(): Promise<void>;
  isStopped(): boolean;
};

export type IrohTcpForwarderOptions = {
  target: IrohConnectTargetOptions['target'];
  alpn: string;
  listenPort?: number;
  preamble?: Uint8Array;
};

export type BridgeLike = Pick<
  PublishedIrohBridge,
  | 'bridgeVersion'
  | 'nodeId'
  | 'start'
  | 'stop'
  | 'isRunning'
  | 'connect'
  | 'connectTarget'
  | 'openSession'
  | 'openTargetSession'
> & {
  /** Added in bridge 0.3; optional while npm's latest release remains 0.2.0. */
  startTcpForwarder?: (options: IrohTcpForwarderOptions) => Promise<IrohTcpForwarder>;
};

/** The real npm bridge. Tests and diagnostic builds may inject a BridgeLike. */
export function getIrohBridge(bridge: BridgeLike = getPublishedIrohBridge()): BridgeLike {
  return bridge;
}

export async function bridgeDiagnostics(bridge: BridgeLike): Promise<{
  packageVersion: string;
  nodeId: string;
  running: boolean;
}> {
  const [packageVersion, nodeId, running] = await Promise.all([
    bridge.bridgeVersion(),
    bridge.nodeId(),
    bridge.isRunning(),
  ]);
  return {
    packageVersion: String(packageVersion),
    nodeId: String(nodeId),
    running: Boolean(running),
  };
}

/** Compatibility alias for consumers migrating from the pre-0.2 skeleton. */
export type IrohBridge = BridgeLike;
