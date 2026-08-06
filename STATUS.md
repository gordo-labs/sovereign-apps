# Sovereign Apps — Status

## 2026-08-06 — Public baseline, not stable

The source has been reviewed as a candidate neutral sovereign-app template.
It is a useful architecture sketch but is not currently functional.

### Verified state

- GitHub: <https://github.com/gordo-labs/sovereign-apps>, public `main`.
- Initial commit: `6c49f8b` (`chore: publish pre-alpha open-source baseline`).
- SA-001 workspace gate prepared on branch `codex/sa001-workspace`; frozen
  install and task discovery are now pinned to Node 22/pnpm 9.15.9.
- Version: `0.0.1`, pre-alpha; no stable release or tag.
- npm bridge: `@gordo-labs/react-native-iroh@0.2.0` is public and resolves with
  `latest=0.2.0`; the former registry blocker is closed.
- Standard install: lockfile and public bridge dependency are present; clean
  Node 22 verification remains the merge gate (local host is Node 26).
- Build/typecheck: `@sovereign-apps/protocol` passes after SA-002; full workspace remains gated by parallel tasks.
- Protocol tests: five non-empty Node test groups pass, including fragmentation and hostile-input cases.
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
