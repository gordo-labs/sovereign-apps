# Sovereign Apps — Status

## 2026-08-06 — Public baseline, not stable

The source has been reviewed as a candidate neutral sovereign-app template.
It is a useful architecture sketch but is not currently functional.

### Verified state

- GitHub: <https://github.com/gordo-labs/sovereign-apps>, public `main`.
- Initial commit: `6c49f8b` (`chore: publish pre-alpha open-source baseline`).
- Initial CI: red because pnpm is not pinned; this is the first SA-001 gate.
- Version: `0.0.1`, pre-alpha; no stable release or tag.
- npm bridge: `@gordo-labs/react-native-iroh@0.2.0` is public and resolves with
  `latest=0.2.0`; the former registry blocker is closed.
- Standard install: still not reproducibly certified because pnpm/lockfile are
  unpinned and first-party React/RN peers require alignment.
- Build/typecheck: fail in `@sovereign-apps/protocol`.
- Tests: command succeeds with zero tests.
- Lint: fails because the current prototype web app launches interactive setup.
- Desktop/mobile pairing: not end-to-end wired or verified.
- Wi-Fi module: serialization helpers only; no advertiser or browser runtime.
- Web presence: current simulated landing is not the target. Planned output is
  an installable helper plus a minimal Next.js integration example.
- Bluetooth: not present; BLE bootstrap and any data transport are separate tasks.

### Why this matters

The repository must not claim production or stable readiness. The immediate goal
is to turn the public baseline into a reproducible, tested reference flow before
adding further communication modules.

### Next work

Follow [working/BACKLOG.md](./working/BACKLOG.md), beginning with source-freeze
task `SA-000`, then `SA-001` through `SA-006`. Every task has an atomic prompt
under `working/prompts/`; `ORCHESTRATOR.txt` contains the merge order.

Initial CI evidence:
<https://github.com/gordo-labs/sovereign-apps/actions/runs/31096384990>.
