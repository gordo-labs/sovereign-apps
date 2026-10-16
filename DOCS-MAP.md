# Sovereign Apps — Docs Map

| Need                                       | Read                                                                                                                                    |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| Current truth                              | [STATUS.md](./STATUS.md)                                                                                                                |
| Publishing recommendation and product gaps | [docs/PUBLISHING-READINESS.md](./docs/PUBLISHING-READINESS.md)                                                                          |
| Current bridge contract                    | [docs/BRIDGE-INTEGRATION.md](./docs/BRIDGE-INTEGRATION.md)                                                                              |
| Historical baseline audit                  | [docs/AUDIT-2026-08-06.md](./docs/AUDIT-2026-08-06.md)                                                                                  |
| Intended architecture                      | [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)                                                                                          |
| Public roadmap                             | [docs/ROADMAP.md](./docs/ROADMAP.md)                                                                                                    |
| Native release operations                  | [docs/NATIVE-RELEASE-OPERATIONS.md](./docs/NATIVE-RELEASE-OPERATIONS.md) + [release/support-matrix.json](./release/support-matrix.json) |

Source ownership:

- shared contracts: `packages/protocol/`
- desktop adapter/reference app: `packages/electron-app/`
- mobile adapter/reference app: `packages/react-native-app/`
- web-presence example host: `apps/landing/` (minimal Next.js integration,
  intentionally not a marketing landing)
- installable web presence: `packages/web-presence/` framework-neutral package
  plus Next.js adapter and example routes

The `working/` folder is local-only and intentionally absent from the public
Git history. Public documentation must not link to it.
