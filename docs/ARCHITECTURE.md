# Sovereign Apps — target architecture

> Target architecture. The pre-alpha example implements the QR, Iroh and
> one-use grant path at the framed-stream layer; native-host and device gaps are
> listed in
> [PUBLISHING-READINESS.md](./PUBLISHING-READINESS.md).

## Local-first topology

```text
┌──────────────────┐       mobile opens QUIC session        ┌──────────────────┐
│ Electron desktop │ ◄────────────────────────────────────── │ React Native app │
│ responder        │       bidirectional streams             │ outbound dialer  │
└────────┬─────────┘                                        └────────┬─────────┘
         │                                                             │
         ├──── QR / deep link / file ───────── bootstrap ───────────────┤
         ├──── mDNS/DNS-SD ─────────── untrusted LAN discovery ─────────┤
         └──── BLE / NFC (optional) ── nearby bootstrap ────────────────┘

         ┌──────────────────────────────────────────────────────────────┐
         │ optional installable web-presence helper                    │
         │ short-lived signed presence/signaling cache; never trusted  │
         └──────────────────────────────────────────────────────────────┘
```

The local QR + direct Iroh path works without web presence or a relay. Across
hard NATs, Iroh can use a relay for connectivity assistance or encrypted packet
forwarding. A relay is transport infrastructure, not the app backend,
discovery directory or authorization authority. Custom relay operation and
custom-only endpoint configuration are described in
[`RELAY-OPERATIONS.md`](./RELAY-OPERATIONS.md) and remain V1 work. The current
Electron and React Native examples exchange a short-lived one-use QR reference
over the encrypted Iroh channel and bind the grant to the authenticated
transport peer. Native host/device verification remains pending.

## Module boundaries

| Layer            | Responsibility                                                  | Initial adapters                                                         |
| ---------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Identity/storage | App key, Iroh key, peer grants, secure persistence              | Electron file adapter; RN secure-storage boundary (host adapter pending) |
| Discovery        | Find untrusted candidate records                                | mDNS, optional web presence                                              |
| Bootstrap        | Transfer bounded pairing/candidate material                     | QR; later BLE/NFC/deep-link/file                                         |
| Transport        | Endpoint, session and framed byte streams                       | Iroh Node, published RN Iroh bridge                                      |
| Pairing/auth     | Bind user intent and peer identities; issue/revoke grants       | neutral transcript protocol pieces; host integration pending             |
| App database     | Application-owned local state                                   | no concrete SQLite adapter/schema shipped yet                            |
| Route policy     | Rank/race candidates; reconnect/fallback without auth downgrade | direct Iroh then the endpoint's configured public/custom relay profile    |
| App codec        | Application-owned messages/capabilities                         | removable example only                                                   |
| MCP adapter      | Optionally expose allowlisted app capabilities to local AI       | planned module; no MCP server is shipped                                  |

No discovery or bootstrap adapter grants trust. No transport adapter interprets
application payloads. Capability identifiers are bounded, opaque strings owned
by the generated application.

The optional MCP adapter sits above the app-service and capability boundary; it
does not replace pairing, app authorization, or transport. A local AI client
must be approved separately from the desktop↔mobile pairing and receive a
scoped, revocable grant. If a tool invokes a mobile-owned service, the request
uses the existing paired Iroh channel and the mobile validates the capability
again. The first design uses stdio locally; an authenticated loopback
Streamable HTTP adapter is optional. See
[`MCP-INTEGRATION.md`](./MCP-INTEGRATION.md) for the trust model, threat
boundaries and PR-sized tasks. MCP is not a core V1 pairing gate.

The `@sovereign-apps/module-kernel` package codifies these boundaries as public
root exports. Its registry preflights composition and starts dependencies before
dependents; optional modules are reported as degraded without falsifying core
readiness. Adapters own their resources and must pass lifecycle/cancellation
conformance before they are usable by platform packages.

## Intended initial pairing flow

```text
Desktop creates one-time expiring pairing session
  → renders QR with the desktop identity, available bootstrap address and
    one-time pairing material
  → mobile validates/scans envelope
  → user confirms peer/fingerprint
  → mobile builds one typed endpoint target from the QR bootstrap address
  → mobile bridge starts its endpoint and dials the desktop responder
  → mobile proves possession of the one-use QR reference on the encrypted
    Iroh stream; Electron checks it against the authenticated peer ID
  → desktop issues a short-lived grant bound to that peer
  → only then should application envelopes be delivered
```

Reconnect uses the stored peer identity and grant. Revocation must prevent a
previously paired device from reconnecting.

## Iroh stream contract

- Desktop uses the supported `@momics/iroh-http-node` API.
- The reusable React Native package keeps the bridge behind
  `getIrohBridge()`, `start`, typed target/session operations and `stop`.
  `apps/mobile` pins public bridge source `0.3.0` as a Git submodule because
  npm still resolves to `0.2.0`.
- Mobile is an outbound dialer; the desktop hosts the incoming responder. Data
  flows in both directions after the session opens.
- Prefer one typed target carrying all direct addresses plus the relay URL, or
  one official endpoint ticket. This allows Iroh to select paths within one
  dial instead of discarding NAT state between attempts.
- The RN bridge owns length-prefix framing on mobile; the Electron adapter owns
  matching framing around raw Node streams. Do not double-frame app payloads.
- The optional HTTP sample uses bridge `startTcpForwarder()` plus Electron's
  matching extra-stream receiver and a loopback-only `/health` endpoint after
  the pairing grant. Contract tests exist; native artifacts and device-level
  verification remain open.
- The native bridge moves bytes only. Pairing, authorization, persistence and
  app-level session policy remain host responsibilities.
- Frames are bounded, runtime validated and subject to backpressure/cancellation.

## Installable web presence

`web-presence` is a server module, not the project's landing page. Its target
shape is:

```text
shared protocol/crypto
        │
        ▼
framework-neutral presence core ── store/rate-limit/clock adapters
        │
        └── Next.js App Router adapter
                    │
                    └── minimal Next.js example project
```

It caches only bounded signed, short-lived presence and optional signaling
envelopes. Clients verify every record against the public key learned during
pairing. The example shows integration and truthful diagnostics; it is not a
marketing site and does not simulate connected peers.

The implementation package is `@sovereign-apps/web-presence`. Its Next adapter
exports route-handler factories (`createNextWebPresenceRoutes`,
`createPresenceRoute`, `createSignalingRoute`, `createBootstrapRoute`) so an
application can mount the same helper below any base path without adopting
route aliases or a product landing page.

## Planned channel semantics

| Channel            | Role                                                         | Trust                             | External infrastructure      |
| ------------------ | ------------------------------------------------------------ | --------------------------------- | ---------------------------- |
| QR                 | Bootstrap                                                    | Requires authenticated transcript | None                         |
| mDNS/Wi-Fi LAN     | Discovery/candidate hint                                     | Untrusted                         | None                         |
| Iroh direct        | Data transport                                               | Bound by pairing/auth             | None when directly reachable |
| Iroh relay         | Data fallback                                                | Bound by pairing/auth             | Relay required               |
| Web presence       | Discovery/signaling fallback                                 | Untrusted signed cache            | Optional server              |
| BLE                | Nearby bootstrap first                                       | Untrusted until pairing           | None                         |
| Bluetooth data     | Not shipped; bootstrap-only until ADR-015 exit criteria pass | N/A                               | N/A                          |
| NFC/deep-link/file | Offline bootstrap handoff                                    | Untrusted until pairing           | None                         |
