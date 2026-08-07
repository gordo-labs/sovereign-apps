# Sovereign Apps — Docs Map

| Need | Read |
| --- | --- |
| Current truth | [STATUS.md](./STATUS.md) |
| Audit evidence and gaps | [docs/AUDIT-2026-08-06.md](./docs/AUDIT-2026-08-06.md) |
| Intended architecture | [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) |
| Music Hub source-to-target map | [working/SOURCE-IMPLEMENTATION-MAP.md](./working/SOURCE-IMPLEMENTATION-MAP.md) |
| Ordered tasks | [working/BACKLOG.md](./working/BACKLOG.md) |
| Agent prompts | [working/prompts/README.md](./working/prompts/README.md) |
| Session trace | [working/history/2026/2026-08.md](./working/history/2026/2026-08.md) |
| Native release operations | [docs/NATIVE-RELEASE-OPERATIONS.md](./docs/NATIVE-RELEASE-OPERATIONS.md) + [release/support-matrix.json](./release/support-matrix.json) |

Source ownership:

- shared contracts: `packages/protocol/`
- desktop adapter/reference app: `packages/electron-app/`
- mobile adapter/reference app: `packages/react-native-app/`
- web-presence example host: `apps/landing/` (minimal Next.js integration,
  intentionally not a marketing landing)
- installable web presence: `packages/web-presence/` framework-neutral package
  plus Next.js adapter and example routes
