/**
 * Sovereign Apps Protocol — tunnel dialer transport.
 *
 * JSON-message tunnel over an Iroh QUIC bidirectional stream.
 * Same pattern as Music Hub's SovereignIrohDialerTransport.
 */

import { encodeFrame, parseMessage, MAX_FRAME_BYTES } from './framing.js';
import type { SovereignMessage } from './types.js';
import type { IrohDialSession, IrohDuplexConnection } from './connection.js';

export class SovereignTunnelTransport implements IrohDuplexConnection {
  readonly peerId: string;
  private readonly handlers = new Set<(message: SovereignMessage) => void>();
  private readonly closeHandlers = new Set<(error?: Error) => void>();
  private pending: Uint8Array = new Uint8Array(0);
  private writeChain = Promise.resolve();
  private closed = false;

  private constructor(
    private readonly session: IrohDialSession,
    private readonly reader: ReadableStreamDefaultReader<Uint8Array>,
    private readonly writer: WritableStreamDefaultWriter<Uint8Array>,
  ) {
    this.peerId = session.remoteId ? String(session.remoteId) : 'sovereign-peer';
    void this.readLoop();
    void session.closed?.then(() => this.markClosed()).catch((error) => {
      this.markClosed(error instanceof Error ? error : new Error(String(error)));
    });
  }

  static async open(session: IrohDialSession): Promise<SovereignTunnelTransport> {
    const stream = await session.createBidirectionalStream();
    return new SovereignTunnelTransport(
      session,
      stream.readable.getReader(),
      stream.writable.getWriter(),
    );
  }

  send(message: SovereignMessage): void {
    if (this.closed) throw new Error('Tunnel is closed');
    const frame = encodeFrame(new TextEncoder().encode(JSON.stringify(message)));
    this.writeChain = this.writeChain
      .then(() => this.writer.write(frame))
      .catch((error) => {
        this.markClosed(error instanceof Error ? error : new Error(String(error)));
      });
  }

  sendRaw(data: Uint8Array): void {
    if (this.closed) throw new Error('Tunnel is closed');
    const frame = encodeFrame(data);
    this.writeChain = this.writeChain
      .then(() => this.writer.write(frame))
      .catch((error) => {
        this.markClosed(error instanceof Error ? error : new Error(String(error)));
      });
  }

  onMessage(handler: (message: SovereignMessage) => void): () => void {
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
    await this.writeChain.catch(() => {});
    await this.writer.close().catch(() => {});
    await this.reader.cancel().catch(() => {});
    this.session.close({ closeCode: 0, reason: 'closed' });
  }

  private async readLoop(): Promise<void> {
    try {
      const chunks: Uint8Array[] = [];
      let accumulated = 0;

      while (true) {
        const { value, done } = await this.reader.read();
        if (done) {
          this.markClosed();
          return;
        }
        chunks.push(value);
        accumulated += value.byteLength;

        // Combine and process complete frames
        const combined = new Uint8Array(accumulated);
        let offset = 0;
        for (const chunk of chunks) {
          combined.set(chunk, offset);
          offset += chunk.byteLength;
        }
        chunks.length = 0;
        accumulated = 0;

        let pos = 0;
        while (pos + 4 <= combined.byteLength) {
          const payloadLen = new DataView(combined.buffer, combined.byteOffset + pos, combined.byteLength - pos).getUint32(0, false);
          const frameEnd = pos + 4 + payloadLen;
          if (frameEnd > combined.byteLength) break;
          const payload = combined.slice(pos + 4, frameEnd);
          const msg = parseMessage(payload);
          for (const handler of this.handlers) handler(msg);
          pos = frameEnd;
        }
        // Keep leftover bytes for next read
        if (pos > 0 && pos < combined.byteLength) {
          chunks.push(combined.slice(pos));
          accumulated = combined.slice(pos).byteLength;
        }
      }
    } catch (error) {
      this.markClosed(error instanceof Error ? error : new Error(String(error)));
    }
  }

  private markClosed(error?: Error): void {
    if (this.closed) return;
    this.closed = true;
    for (const handler of this.closeHandlers) handler(error);
    this.closeHandlers.clear();
    this.handlers.clear();
  }
}
