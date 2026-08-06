# Sovereign Apps — target architecture

> Target, not current implementation. The public baseline is pre-alpha and does
> not yet complete this flow. See `AUDIT-2026-08-06.md` and the ordered backlog.

## Local-first topology

```text
┌──────────────────┐    authenticated Iroh framed streams    ┌──────────────────┐
│ Electron desktop │ ◄──────────────────────────────────────► │ React Native app │
│ responder        │       direct LAN or optional relay       │ outbound dialer  │
└────────┬─────────┘                                          └────────┬─────────┘
         │                                                             │
         ├──── QR / deep link / file ───────── bootstrap ───────────────┤
         ├──── mDNS/DNS-SD ─────────── untrusted LAN discovery ─────────┤
         └──── BLE / NFC (optional) ── nearby bootstrap ────────────────┘

         ┌──────────────────────────────────────────────────────────────┐
         │ optional installable web-presence helper                    │
         │ short-lived signed presence/signaling cache; never trusted  │
         └──────────────────────────────────────────────────────────────┘
```

The local QR + direct Iroh path must work without the web-presence module. A
relay or presence helper is a fallback/rendezvous option, not an authority.

## Module boundaries

| Layer | Responsibility | Initial adapters |
| --- | --- | --- |
| Identity/storage | App key, Iroh key, peer grants, secure persistence | desktop files, Keychain/Keystore |
| Discovery | Find untrusted candidate records | mDNS, optional web presence |
| Bootstrap | Transfer bounded pairing/candidate material | QR; later BLE/NFC/deep-link/file |
| Transport | Endpoint, session and framed byte streams | Iroh Node, published RN Iroh bridge |
| Pairing/auth | Bind user intent and peer identities; issue/revoke grants | neutral transcript protocol |
| Route policy | Rank/race candidates; reconnect/fallback without auth downgrade | direct Iroh then configured fallback |
| App codec | Application-owned messages/capabilities | removable example only |

No discovery or bootstrap adapter grants trust. No transport adapter interprets
application payloads. Capability identifiers are bounded, opaque strings owned
by the generated application.

The `@sovereign-apps/module-kernel` package codifies these boundaries as public
root exports. Its registry preflights composition and starts dependencies before
dependents; optional modules are reported as degraded without falsifying core
readiness. Adapters own their resources and must pass lifecycle/cancellation
conformance before they are usable by platform packages.

## Initial pairing flow

```text
Desktop creates one-time expiring pairing session
  → renders standard QR + app fingerprint
  → mobile validates/scans envelope
  → user confirms peer/fingerprint
  → mobile dials advertised Iroh node with matching ALPN + usable hint
  → both sides authenticate a transcript binding app keys, Iroh node, nonces,
    version, expiry and requested/granted opaque capabilities
  → desktop issues rotating revocable grant
  → only then are application envelopes delivered
```

Reconnect uses the stored peer identity and grant. Revocation must prevent a
previously paired device from reconnecting.

## Iroh stream contract

- Desktop uses the supported `@momics/iroh-http-node` API.
- Mobile uses public `@gordo-labs/react-native-iroh@0.2.0` via
  `getIrohBridge()`, `start`, `connect`/`openSession` and `stop`.
- Mobile is an outbound dialer in bridge `0.2.0`; the architecture must not claim
  an incoming mobile listener.
- The native RN bridge already exposes length-framed messages. The protocol must
  define when raw Node streams need the 4-byte big-endian framing layer so a
  payload is never double-framed.
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

| Channel | Role | Trust | External infrastructure |
| --- | --- | --- | --- |
| QR | Bootstrap | Requires authenticated transcript | None |
| mDNS/Wi-Fi LAN | Discovery/candidate hint | Untrusted | None |
| Iroh direct | Data transport | Bound by pairing/auth | None when directly reachable |
| Iroh relay | Data fallback | Bound by pairing/auth | Relay required |
| Web presence | Discovery/signaling fallback | Untrusted signed cache | Optional server |
| BLE | Nearby bootstrap first | Untrusted until pairing | None |
| Bluetooth data | Not shipped; bootstrap-only until ADR-015 exit criteria pass | N/A | N/A |
| NFC/deep-link/file | Offline bootstrap handoff | Untrusted until pairing | None |
