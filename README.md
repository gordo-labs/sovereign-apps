# Sovereign Apps

An open-source monorepo intended to become a neutral, modular template for
desktop-to-mobile sovereign applications. Its target is authenticated peer-to-peer
communication with no application-specific domain logic.

> **Status: pre-alpha public baseline.** Automated workspace and contract gates
> pass, but physical native evidence is still required and this is not for
> production. See [STATUS.md](./STATUS.md) and
> [the 2026-08-06 audit](./docs/AUDIT-2026-08-06.md).

## Intended modules

| Surface | Intended responsibility | Current reality |
| --- | --- | --- |
| `@sovereign-apps/protocol` | Neutral framing, pairing, auth, capabilities | Implemented with validation, signed presence and negative tests |
| `@sovereign-apps/electron-app` | Desktop Iroh endpoint and QR pairing UI | Real adapter, identity persistence, QR and LAN discovery; runtime fixture pending |
| `@sovereign-apps/react-native-app` | Mobile QR client and Iroh bridge adapter | Published bridge `0.2.0` adapter and trust boundary; physical app evidence pending |
| `@sovereign-apps/web-presence` | Installable signed-presence helper with framework adapters | Framework-neutral core plus Next.js route factories |
| `apps/landing` | Minimal host integration for `web-presence` | Neutral Next.js web-presence example, not a product/marketing landing |

## Target architecture

The stable template should separate five concerns so adopters can select only
the modules they need:

1. identity and key storage;
2. discovery/bootstrap (QR, mDNS/LAN, later BLE or other local channels);
3. authenticated pairing and capability grants;
4. transport adapters (initially Iroh QUIC); and
5. application-owned messages above the transport.

The initial reference flow is desktop QR display → mobile QR scan → fingerprint
verification → authenticated pairing → framed bidirectional Iroh QUIC channel.

## Current validation

Run with Node 22 and pnpm 9.15.9. On the current host, frozen install, format,
lint, typecheck, build, tests, contract E2E, release audit and package dry-run
pass. The native release manifest remains intentionally blocked until physical
iOS/Android evidence is recorded.

The exact evidence and reproduction commands are recorded in
[docs/AUDIT-2026-08-06.md](./docs/AUDIT-2026-08-06.md).

## Roadmap and agent handoff

- Ordered work: [working/BACKLOG.md](./working/BACKLOG.md)
- One self-contained prompt per task: [working/prompts/README.md](./working/prompts/README.md)
- Canonical extraction map: [working/SOURCE-IMPLEMENTATION-MAP.md](./working/SOURCE-IMPLEMENTATION-MAP.md)
- Architecture draft: [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)

No roadmap item is represented as implemented until its acceptance checks pass.

## Provenance

The initial concept and some patterns come from Gordo Labs' MIT-licensed Music
Streaming Hub desktop implementation and the public
[`iroh-react-native-bridge`](https://github.com/gordo-labs/iroh-react-native-bridge).
The stable extraction must remain application-neutral and preserve required
license notices.

## License

[MIT](./LICENSE) © 2026 Gordo Labs.
