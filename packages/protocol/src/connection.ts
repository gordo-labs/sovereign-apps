/**
 * Sovereign Apps Protocol — abstract connection interface.
 *
 * Defines the minimal surface any platform (Electron via @momics/iroh-http-node,
 * React Native via UniFFI bridge) must implement to interoperate.
 */

export interface IrohDuplexConnection {
  /** The peer's node id, if known. */
  peerId?: string;

  /** Send a raw Uint8Array over the stream. */
  send(data: Uint8Array): Promise<void> | void;

  /** Register a message handler. Returns an unsubscribe function. */
  onMessage(handler: (data: Uint8Array) => void): (() => void) | void;

  /** Register a close handler. Returns an unsubscribe function. */
  onClose?(handler: () => void): (() => void) | void;

  /** Close the connection. */
  close(): Promise<void> | void;
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

export interface IrohDialOptions {
  directAddrs?: string[];
  relayUrl?: string;
}
