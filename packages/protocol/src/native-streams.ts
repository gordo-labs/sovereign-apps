/**
 * Identifies a TCP-forwarded Iroh stream before its application bytes begin.
 * This value is intentionally independent of any application or HTTP scheme.
 */
export const NATIVE_TCP_STREAM_PREAMBLE = new Uint8Array([
  0x53, 0x41, 0x54, 0x43, 0x50, 0x00, 0x01, 0x00,
]);

export function matchesNativeTcpStreamPreamble(value: Uint8Array): boolean {
  return (
    value.byteLength === NATIVE_TCP_STREAM_PREAMBLE.byteLength &&
    NATIVE_TCP_STREAM_PREAMBLE.every((byte, index) => value[index] === byte)
  );
}
