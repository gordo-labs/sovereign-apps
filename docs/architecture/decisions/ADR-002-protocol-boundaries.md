# ADR-002: One framed, versioned neutral wire protocol

Status: accepted for SA-002 (2026-08-06)

The protocol package owns the byte-stream frame, versioned envelope and
runtime validation. A raw Node/Iroh stream uses a four-byte big-endian length
prefix followed by a non-empty payload, with a 2 MiB upper bound. `FrameDecoder`
is incremental and retains incomplete headers/payloads. Writes must be queued
by the transport adapter to preserve order and backpressure.

The published React Native Iroh bridge is a transport boundary. Its native
session framing is not wrapped again by this package; bridge adapters consume
complete envelope bytes according to the bridge contract. Raw stream adapters
use `encodeEnvelope`/`EnvelopeDecoder` exactly once.

All envelope, pairing QR, authentication, candidate, presence and signaling
objects are validated through the shared Zod schemas. Unknown envelope versions
and types, zero/oversized frames, malformed JSON and recursively forbidden
domain fields are rejected before application dispatch. Discovery and presence
records remain untrusted hints; signature, TTL, replay and paired-key checks
belong to the pairing/presence implementation and must consume these schemas.

Compatibility behavior is represented by neutral fixtures and tests rather than
duplicated desktop/mobile/Next.js definitions.
