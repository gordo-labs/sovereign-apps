# AGENTS.md — Sovereign Apps

Pre-alpha component monorepo for desktop/mobile QR pairing and optional
application-neutral communication modules. Minimal Electron and React Native
hosts are checked in. Physical host verification, durable grant storage and an
upstream-published bridge 0.3 runtime are still pending.

## Repository structure

```
sovereign-apps/
├── packages/
│   ├── protocol/          # @sovereign-apps/protocol — shared Iroh types, framing, tunnel
│   ├── electron-app/      # @sovereign-apps/electron-app — desktop shell + Iroh node
│   └── react-native-app/  # @sovereign-apps/react-native-app — mobile shell + Iroh bridge
├── apps/
│   ├── landing/           # @sovereign-apps/landing — minimal Next.js web-presence example
│   └── mobile/            # @sovereign-apps/mobile-example — iOS/Android QR host
├── vendor/
│   └── iroh-react-native-bridge/ # public bridge source pinned to 0.3.0
├── docs/
├── .github/
└── pnpm-workspace.yaml
```

## Every session

1. `PROJECT.json` + `STATUS.md` + `DOCS-MAP.md`
2. `git status --short --branch`

The repository is pre-alpha. Do not treat in-process fixtures as physical
device evidence. Public release and implementation state is documented in
`docs/PUBLISHING-READINESS.md` and `docs/ROADMAP.md`. Local `working/` notes are
not tracked or required.

## Build

```bash
pnpm install
pnpm build
```

## Protocol

- **Transport:** Electron is the Iroh responder; `@gordo-labs/react-native-iroh` is the mobile outbound dialer
- **ALPN:** `sovereign-apps/1`
- **Framing:** 4-byte big-endian length prefix + JSON payload (max 2 MB)
- **Relay:** n0 relay by default, direct hole-punch for LAN peers

## Communication contract

The user scans or opens a desktop-generated, short-lived QR pairing envelope.
After confirming the desktop fingerprint, the mobile endpoint dials Electron
over Iroh and sends the one-use session reference on the encrypted stream.
Electron binds its grant to the authenticated Iroh peer ID. The optional
node-to-node and presence modules are not required for this flow.

## License

MIT
