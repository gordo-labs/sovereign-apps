# Web presence security boundary

This package is an untrusted, short-lived cache. `PresenceCodec` must be wired
to the canonical SA-002 schema and signature verifier, using a public key
learned from authenticated pairing. The core rejects malformed, expired,
future, replayed, oversized and nested-forbidden records, and bounds candidate
and signaling counts. It never turns publication into identity, reachability,
pairing or authorization. Memory stores are test/development adapters only;
production requires an atomic durable compare-and-swap store and distributed
rate limiting.
