# Sovereign Apps — Status

## 2026-08-06 — Public pre-alpha, integration gates passing

The source has been reviewed as a candidate neutral sovereign-app template.
The neutral modular reference flow is implemented and its automated integration
gates pass. It remains pre-alpha: physical native evidence is still required
before a stable release claim.

### Verified state

- GitHub: <https://github.com/gordo-labs/sovereign-apps>, public `main`.
- Current integration branch: `codex/stabilize-sovereign-apps`; public remote is
  <https://github.com/gordo-labs/sovereign-apps>.
- Frozen install and task discovery are pinned to Node 22/pnpm 9.15.9. The
  current host is Node 26, so a clean Node 22 run remains a release check.
- Version: `0.0.1`, pre-alpha; no stable release or tag.
- npm bridge: `@gordo-labs/react-native-iroh@0.2.0` is public and resolves with
  `latest=0.2.0`; the former registry blocker is closed.
- Standard install, format, lint, typecheck, build, workspace tests, contract
  E2E, release audit and package dry-run all pass on the current host.
- The protocol, module kernel, desktop Iroh adapter, React Native adapter,
  secure pairing, LAN discovery, route policy, web presence and generator are
  implemented and covered by non-empty tests.
- The web surface is a neutral `@sovereign-apps/web-presence` package plus a
  minimal Next.js example under `apps/landing`; it is an installable module
  example, not a product marketing landing.
- BLE bootstrap: optional `@sovereign-apps/ble-bootstrap` now provides a bounded,
  SHA-256 checked GATT fragment codec, timeout/cancellation session, honest
  platform-adapter contracts and an in-memory central/peripheral test adapter.
  Native CoreBluetooth/Android/desktop adapters and physical-device gates remain
  pending; no BLE bulk-data or background-availability claim is made.
- Bluetooth data transport: explicit SA-015 no-go. There are no native GATT,
  L2CAP or Classic adapters or physical throughput/reconnect/background
  measurements; Bluetooth remains bootstrap-only and has a zero verified
  payload limit. See `docs/ADR-015-bluetooth-transport.md`.
- Web presence core: implemented in `packages/web-presence` with memory-only
  development adapters and framework-neutral Next route factories; it is not a
  marketing landing and is not yet a stable release.
- SA-006 release gates: deterministic in-process desktop↔mobile contract E2E,
  non-empty-suite enforcement, package dry-run coverage and a machine-readable
  evidence manifest are now present. CI keeps physical QR/auth/reconnect/revoke
  evidence explicit for release candidates; this does not claim that evidence.

### Remaining release blockers

- Real Electron ↔ physical iOS/Android QR, camera, secure-storage, reconnect
  and revoke evidence is not available in this workspace.
- Native BLE, platform mDNS permissions and device/network measurements remain
  unimplemented; Bluetooth data transport is explicitly a no-go (bootstrap only).
- The opt-in real two-node Iroh test is skipped unless native/runtime fixtures
  are supplied. No stable tag or npm publish is being made.

### Next work

Follow [working/BACKLOG.md](./working/BACKLOG.md) for the remaining physical
evidence work. Every task retains an atomic prompt under `working/prompts/`;
`ORCHESTRATOR.txt` records the dependency order.

Initial CI evidence:
<https://github.com/gordo-labs/sovereign-apps/actions/runs/31096384990>.

The current SA-006 gate is `pnpm release:gates`. It deliberately does not tag,
publish, or promote this pre-alpha repository.

SA-012 now supplies the native support matrix, sanitized evidence schema,
operator runbook, and cross-OS workflow. Physical iOS/Android host projects and
hardware evidence are intentionally still blocking; see
[`docs/NATIVE-RELEASE-OPERATIONS.md`](docs/NATIVE-RELEASE-OPERATIONS.md).
