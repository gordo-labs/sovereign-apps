import { FrameDecoder, encodeFrame } from './framing.js';

/** Version of the application hello exchanged inside a native Iroh stream. */
export const STREAM_HELLO_VERSION = 1 as const;
export const STREAM_HELLO_MAX_ALPN_BYTES = 128;
export const STREAM_HELLO_TIMEOUT_MS = 5_000;
const STREAM_HELLO_MAGIC = new Uint8Array([0x53, 0x41, 0x48, 0x31]); // SAH1
const STREAM_HELLO_HEADER_BYTES = 7;

export type StreamHello = Readonly<{
  version: typeof STREAM_HELLO_VERSION;
  alpn: string;
}>;

export type StreamHelloIo = Readonly<{
  read(): Promise<Uint8Array | null>;
  write(data: Uint8Array): Promise<void>;
}>;

function assertAlpn(alpn: string): Uint8Array {
  if (typeof alpn !== 'string' || alpn.length < 1)
    throw new Error('Stream ALPN must be a non-empty string');
  const encoded = new TextEncoder().encode(alpn);
  if (encoded.byteLength > STREAM_HELLO_MAX_ALPN_BYTES)
    throw new Error(`Stream ALPN exceeds ${STREAM_HELLO_MAX_ALPN_BYTES} bytes`);
  if ([...encoded].some((value) => value < 0x20 || value === 0x7f))
    throw new Error('Stream ALPN contains control characters');
  return encoded;
}

export function encodeStreamHello(alpn: string): Uint8Array {
  const domain = assertAlpn(alpn);
  const payload = new Uint8Array(STREAM_HELLO_HEADER_BYTES + domain.byteLength);
  payload.set(STREAM_HELLO_MAGIC, 0);
  payload[4] = STREAM_HELLO_VERSION;
  new DataView(payload.buffer).setUint16(5, domain.byteLength, false);
  payload.set(domain, STREAM_HELLO_HEADER_BYTES);
  return encodeFrame(payload, STREAM_HELLO_HEADER_BYTES + STREAM_HELLO_MAX_ALPN_BYTES);
}

export function decodeStreamHello(payload: Uint8Array): StreamHello {
  if (!(payload instanceof Uint8Array) || payload.byteLength < STREAM_HELLO_HEADER_BYTES)
    throw new Error('Stream hello is truncated');
  if (!STREAM_HELLO_MAGIC.every((value, index) => payload[index] === value))
    throw new Error('Stream hello magic mismatch');
  if (payload[4] !== STREAM_HELLO_VERSION)
    throw new Error(`Unsupported stream hello version: ${payload[4]}`);
  const alpnBytes = new DataView(payload.buffer, payload.byteOffset, payload.byteLength).getUint16(
    5,
    false,
  );
  if (
    alpnBytes < 1 ||
    alpnBytes > STREAM_HELLO_MAX_ALPN_BYTES ||
    payload.byteLength !== STREAM_HELLO_HEADER_BYTES + alpnBytes
  )
    throw new Error('Invalid stream hello ALPN length');
  const alpn = new TextDecoder('utf-8', { fatal: true }).decode(
    payload.slice(STREAM_HELLO_HEADER_BYTES),
  );
  assertAlpn(alpn);
  return { version: STREAM_HELLO_VERSION, alpn };
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0)
    throw new RangeError('Stream hello timeout must be positive');
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('Stream hello negotiation timed out')),
      timeoutMs,
    );
    promise.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

/**
 * Perform an application-level hello because the native @momics Iroh API has
 * no configurable ALPN. Both peers send first, then validate the framed hello
 * before exposing application bytes. Extra frames before negotiation are
 * rejected instead of being silently interpreted under the wrong protocol.
 */
export async function negotiateStreamHello(
  io: StreamHelloIo,
  options: { alpn: string; timeoutMs?: number },
): Promise<void> {
  assertAlpn(options.alpn);
  // Start the write without waiting for its backpressure promise. QUIC stream
  // implementations may only resolve a write once the peer reads; both sides
  // must therefore be able to enter the read phase concurrently.
  const writePromise = io.write(encodeStreamHello(options.alpn));
  const decoder = new FrameDecoder({
    maxFrameBytes: STREAM_HELLO_HEADER_BYTES + STREAM_HELLO_MAX_ALPN_BYTES,
  });
  try {
    let payload: Uint8Array | undefined;
    while (!payload) {
      const chunk = await withTimeout(io.read(), options.timeoutMs ?? STREAM_HELLO_TIMEOUT_MS);
      if (chunk === null) throw new Error('Peer closed before stream hello');
      const frames = decoder.push(chunk);
      if (frames.length > 1) throw new Error('Peer sent application data before stream hello');
      if (frames.length === 1) payload = frames[0];
    }
    decoder.finish();
    const hello = decodeStreamHello(payload);
    if (hello.version !== STREAM_HELLO_VERSION || hello.alpn !== options.alpn)
      throw new Error(
        `Stream hello mismatch: expected ${options.alpn}, received ${hello.alpn} (v${hello.version})`,
      );
    await withTimeout(writePromise, options.timeoutMs ?? STREAM_HELLO_TIMEOUT_MS);
  } catch (error) {
    // Do not wait for a backpressured write after the read side has timed out
    // or rejected; callers will close the stream. Attach a handler so a late
    // native rejection cannot become an unhandled promise.
    void writePromise.catch(() => undefined);
    throw error;
  }
}
