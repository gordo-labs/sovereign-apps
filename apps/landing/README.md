# Web presence Next.js example

This folder is a deliberately small App Router example for installing
`@sovereign-apps/web-presence` into an existing Next.js application. It is not
a product landing page. The module is optional: QR pairing, local mDNS/Wi-Fi,
and direct Iroh connections do not depend on it.

## Run

```sh
cp .env.example .env.local
pnpm --filter @sovereign-apps/web-presence-example dev
```

The example exposes:

- `GET /api/web-presence/bootstrap` — installable bootstrap metadata.
- `GET|PUT|POST /api/web-presence/presence/:identity` — publish or resolve a
  signed record. `GET` sanitizes output for the diagnostic page.
- `GET|PUT|POST /api/web-presence/signaling/:identity/:sessionId` — optional
  signed signaling inbox.
- `GET /api/health` — deployment-neutral health check.

The route handlers are composed from the public factories in
`@sovereign-apps/web-presence/next`; no protocol schema, store, or crypto is
copied into this example. The injected codec uses the canonical
`@sovereign-apps/protocol` parser and Ed25519 verification. A record is accepted
only when its signature, identity, TTL, replay ordering, size, and metadata
limits pass.

Memory stores are for development/tests only. Before production, call
`configureWebPresenceRuntime()` with an atomic durable presence store, durable
signaling store, and distributed rate limiter. Put the service behind the
application's authenticated proxy/rate-limit boundary, preserve `Cache-Control:
no-store`, and do not log record bodies, signatures, addresses, or payloads.

Presence is untrusted rendezvous data. It does not prove identity, reachability,
pairing, or authorization; the paired desktop/mobile client must verify and
connect independently. Do not put secrets, app payloads, LAN credentials, or
private addresses in a record.
