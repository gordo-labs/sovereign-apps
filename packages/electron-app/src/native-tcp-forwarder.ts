import { createConnection } from 'node:net';
import { Readable, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type {
  ReadableStream as NodeReadableStream,
  WritableStream as NodeWritableStream,
} from 'node:stream/web';
import {
  matchesNativeTcpStreamPreamble,
  NATIVE_TCP_STREAM_PREAMBLE,
} from '@sovereign-apps/protocol';
import type { IrohExtraStream } from './iroh-node.js';

export type NativeTcpForwarderTarget = { port: number };

/** Adapt one bridge 0.3 extra Iroh stream to an app-owned loopback TCP service. */
export async function forwardNativeTcpStream(
  stream: IrohExtraStream,
  target: NativeTcpForwarderTarget,
): Promise<void> {
  if (!Number.isInteger(target.port) || target.port < 1 || target.port > 65_535)
    throw new Error('Native TCP forward target port is invalid');
  const socket = createConnection({ host: '127.0.0.1', port: target.port });
  const incoming = stripNativeTcpPreamble(stream.readable);
  try {
    await Promise.all([
      pipeline(Readable.fromWeb(incoming as unknown as NodeReadableStream), socket),
      pipeline(socket, Writable.fromWeb(stream.writable as unknown as NodeWritableStream)),
    ]);
  } catch (error) {
    socket.destroy(error instanceof Error ? error : new Error(String(error)));
    await stream.writable.abort(error).catch(() => undefined);
    await stream.readable.cancel(error).catch(() => undefined);
    throw error;
  }
}

function stripNativeTcpPreamble(source: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  let prefix = new Uint8Array();
  let verified = false;
  return source.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        if (verified) {
          if (chunk.byteLength) controller.enqueue(chunk);
          return;
        }
        const combined = new Uint8Array(prefix.byteLength + chunk.byteLength);
        combined.set(prefix);
        combined.set(chunk, prefix.byteLength);
        const expected = NATIVE_TCP_STREAM_PREAMBLE.byteLength;
        if (combined.byteLength < expected) {
          prefix = combined;
          return;
        }
        if (!matchesNativeTcpStreamPreamble(combined.slice(0, expected)))
          throw new Error('Native Iroh stream preamble is not recognized');
        verified = true;
        prefix = new Uint8Array();
        if (combined.byteLength > expected) controller.enqueue(combined.slice(expected));
      },
      flush() {
        if (!verified) throw new Error('Native Iroh stream ended before its preamble completed');
      },
    }),
  );
}
