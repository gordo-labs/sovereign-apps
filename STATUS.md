# Sovereign Apps — Status

## 2026-08-06 — Public baseline, not stable

The source has been reviewed as a candidate neutral sovereign-app template.
It is a useful architecture sketch but is not currently functional.

### Verified state

- GitHub: <https://github.com/gordo-labs/sovereign-apps>, public `main`.
- Initial commit: `6c49f8b` (`chore: publish pre-alpha open-source baseline`).
- Initial CI: red because pnpm is not pinned; this is the first SA-001 gate.
- Version: `0.0.1`, pre-alpha; no stable release or tag.
- Standard install: fails because `@gordo-labs/react-native-iroh` is absent from npm.
- Build/typecheck: fail in `@sovereign-apps/protocol`.
- Tests: command succeeds with zero tests.
- Lint: fails because the landing linter launches interactive setup.
- Desktop/mobile pairing: not end-to-end wired or verified.
- Wi-Fi module: serialization helpers only; no advertiser or browser runtime.
- Bluetooth: not present.

### Why this matters

The repository must not claim production or stable readiness. The immediate goal
is to turn the public baseline into a reproducible, tested reference flow before
adding further communication modules.

### Next work

Follow [working/BACKLOG.md](./working/BACKLOG.md), beginning with `SA-001` through
`SA-006`. Every task has an atomic prompt under `working/prompts/`.

Initial CI evidence:
<https://github.com/gordo-labs/sovereign-apps/actions/runs/31096384990>.
