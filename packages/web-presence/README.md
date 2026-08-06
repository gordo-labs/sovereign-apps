# `@sovereign-apps/web-presence`

Optional server-side discovery/signaling cache. It is deliberately not a
landing page and must never be required for QR, mDNS or direct Iroh operation.
Records remain untrusted: a consumer verifies them using the identity/key
learned during pairing. Publishing a valid record grants no identity,
reachability, pairing or authorization.

The package consumes the canonical SA-002 codec through `PresenceCodec`; it
does not duplicate the wire schema or cryptography. The in-memory adapters are
for tests/development only. Production deployments must provide a durable,
atomic `putIfNewer` store (compare-and-swap on issued timestamp), a durable
signaling store, and a distributed rate limiter. Use `create*Route` factories
from `@sovereign-apps/web-presence/next` in any Next App Router path.
