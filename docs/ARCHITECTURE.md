# Sovereign Apps — Architecture

> **Target architecture, not current implementation.** The 2026-08-06 audit
> found that the flows below are only partially scaffolded and are not end-to-end
> functional. See [`AUDIT-2026-08-06.md`](./AUDIT-2026-08-06.md).

## Network topology

```
┌────────────────┐      Iroh QUIC (n0 relay / hole-punch)      ┌────────────────┐
│  Electron App  │ ◄─────────────────────────────────────────► │  React Native  │
│  (desktop)     │    framed JSON stream (sovereign-apps/1)    │  (mobile)      │
└────────────────┘                                             └────────────────┘
        │                                                                 │
        │ @momics/iroh-http-node                                        │ @gordo-labs/react-native-iroh
        │ NAPI-RS native module                                          │ UniFFI + TurboModule (Rust)
        └────────────────────────────────────────────────────────────────┘

                              ┌──────────────────────┐
                              │   Landing / PRISONS   │
                              │   (Next.js web)       │
                              └──────────────────────┘
                              Preview & documentation
```

## Target pairing flow (initial local setup)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Desktop shows QR + fingerprint                                           │
│ LAN UDP broadcast advertisement                                          │
└──────────────────────────────────────────────────────────────────────────┘
                                                                           │
        QR scan (or LAN auto-discover)                                     │
                                                                           ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ Mobile parses payload — hubId, nodeId, fingerprint                       │
│ User visually verifies fingerprint matches desktop screen                │
└──────────────────────────────────────────────────────────────────────────┘
                                                                           │
        Ed25519 challenge-response auth                                    │
        over Iroh QUIC tunnel                                              │
                                                                           ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ Capability grant (app.read, media.stream, relay.use)                    │
│ Paired peer record stored                                                │
│ Subsequent connections use Iroh QUIC (relay or direct hole-punch)       │
└──────────────────────────────────────────────────────────────────────────┘
```

## Target connection flow

```
Electron node                           React Native node
┌─────────────┐                       ┌──────────────────┐
│ startEndpoint                       │ startEndpoint    │
│ → nodeId, ticket                     │ → nodeId          │
│ serveSessions()                     │                  │
└─────┬───────┘                       └──────┬───────────┘
      │                                      │
      │  Dial: nodeId + relayUrl             │
      │─────────────────────────────────────►│
      │                                      │
      │  QUIC bi-directional stream          │
      │◄═════════════════════════════════════►│
      │                                      │
      │  framed JSON: {type, payload}        │
      │─────────────────────────────────────►│
      │                                      │
      │  framed JSON reply                   │
      │◄─────────────────────────────────────│
```

## Wire format

```
[4 bytes: big-endian uint32 payload length]
[N bytes: payload (JSON-encoded SovereignMessage)]
```

- **Max frame:** 2 MB
- **Default ALPN:** `sovereign-apps/1`
- **Relay mode:** `RelayMode::Default` (n0 relay, falls back to direct hole-punch)

## Proposed pairing protocol layers

| Layer | Module | Responsibility |
|---|---|---|
| **QR payload** | `protocol/src/pairing.ts` | Build, parse pairing QR data |
| **Auth handshake** | `protocol/src/auth.ts` | Challenge → response → grant with Ed25519 |
| **WiFi-direct** | `protocol/src/wifi-direct.ts` | LAN UDP advertisement + discovery |
| **Desktop UI** | `electron-app/src/pairing-ui.ts` | QR screen, fingerprint, status, peer list |
| **QR generation** | `electron-app/src/qr-generator.ts` | Pure-TS QR v3 generator (no dependencies) |
| **Mobile client** | `react-native-app/src/hub-pairing.ts` | QR scan, fingerprint verify, auth |
| **Desktop session** | `protocol/src/hub-pairing.ts` | DesktopPairingSession state machine |

## Capability model

| Capability | Meaning |
|---|---|
| `app.read` | Read application data |
| `app.write` | Write application data |
| `media.stream` | Stream real-time media |
| `relay.provide` | Relay traffic on the mesh |
| `relay.use` | Use another peer's relay |
