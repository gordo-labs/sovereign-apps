# AGENTS.md — Sovereign Apps

Monorepo template for sovereign P2P apps: **Electron** (desktop), **React Native**
(mobile), **Landing** (web preview) — all connected via Iroh QUIC.

## Repository structure

```
sovereign-apps/
├── packages/
│   ├── protocol/          # @sovereign-apps/protocol — shared Iroh types, framing, tunnel
│   ├── electron-app/      # @sovereign-apps/electron-app — desktop shell + Iroh node
│   └── react-native-app/  # @sovereign-apps/react-native-app — mobile shell + Iroh bridge
├── apps/
│   └── landing/           # @sovereign-apps/landing — Next.js PRISONS preview
├── docs/
├── .github/
└── pnpm-workspace.yaml
```

## Every session

1. `PROJECT.json` + `STATUS.md` + `DOCS-MAP.md`
2. `git status --short --branch`

The repository is pre-alpha. Do not treat skeletons, stubs, simulated UI or a
zero-test command as functional. Work from `working/BACKLOG.md` and run only the
task explicitly assigned.

## Build

```bash
pnpm install
pnpm build
```

## Protocol

- **Transport:** Iroh QUIC via `@momics/iroh-http-node` (Electron) and `@gordo-labs/react-native-iroh` (mobile)
- **ALPN:** `sovereign-apps/1`
- **Framing:** 4-byte big-endian length prefix + JSON payload (max 2 MB)
- **Relay:** n0 relay by default, direct hole-punch for LAN peers

## Derived from

Music Hub's sovereign networking implementation:
- `desktop/src/core/sovereign/iroh-hub-responder.ts` — Electron listener
- `desktop/src/core/sovereign/iroh-hub-dialer.ts` — Electron dialer
- `iroh-react-native-bridge/rust/iroh_mobile_bridge/src/lib.rs` — RN native bridge

## License

MIT
