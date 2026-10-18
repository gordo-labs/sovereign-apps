# Sovereign Apps — Status

## 2026-10-16 — Public pre-alpha component template

The repository contains reusable protocol, transport, pairing and optional
bootstrap/web-presence modules. Electron now displays the Iroh bootstrap QR;
React Native scans or opens it, confirms the fingerprint, dials the desktop,
and exchanges a one-use pairing grant bound to the Iroh peer. The flow has
contract tests but has not been verified on physical iOS/Android hosts.

### Verified state

- GitHub: <https://github.com/gordo-labs/sovereign-apps>, public `main`.
- Current branch: `gordo/stabilize-sovereign-apps`; public remote is
  <https://github.com/gordo-labs/sovereign-apps>.
- The `working/` folder is intentionally local-only and ignored. Public docs and
  contribution guidance are self-contained under the repository's `docs/` tree.
- Version: `0.0.1`, pre-alpha; no stable release or tag.
- npm bridge: `@gordo-labs/react-native-iroh@0.2.0` is public and resolves with
  `latest=0.2.0`; the former registry blocker is closed.
- `apps/mobile` is a checked-in React Native 0.81.6 iOS/Android host with
  camera permissions and the `sovereign://pair` scheme. It imports the common
  pairing UI and autolinks the native bridge.
- The host pins public bridge source at commit `3d9ec405` (0.3.0) because npm
  still serves 0.2.0. Rustup targets are required to generate platform
  artifacts; generated binaries are not committed in the submodule.
- The mobile adapter uses typed endpoint targets, combines direct and relay
  hints for one peer, and feature-detects the bridge 0.3 TCP-forwarder API.
- The template now completes QR intake, fingerprint confirmation, Iroh dial,
  one-use session proof and peer-bound grant exchange over a framed stream.
  The one-use grant is an initial example contract, not persisted across app
  restarts or backed by a concrete mobile secure-storage adapter.
- The neutral TCP-forwarder preamble and Electron extra-stream adapter are
  implemented and contract-tested. Electron exposes a loopback-only `/health`
  service only after the one-use grant succeeds.
- Native end-to-end is not verified: Rustup iOS/Android targets are missing
  here, and the registry's 0.2.0 iOS package fails linking with missing UniFFI
  symbols. The HTTP tunnel cannot be claimed runnable until bridge 0.3 artifacts
  build and link.
- The bridge is mobile outbound-only; the desktop is the responder. The QUIC
  streams are bidirectional after connection.
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
  payload limit. See `docs/architecture/decisions/ADR-015-bluetooth-transport.md`.
- Web presence core: implemented in `packages/web-presence` with memory-only
  development adapters and framework-neutral Next route factories; it is not a
  marketing landing and is not yet a stable release.
- SA-006 release gates: deterministic in-process desktop↔mobile contract E2E,
  non-empty-suite enforcement, package dry-run coverage and a machine-readable
  evidence manifest are now present. CI keeps physical QR/auth/reconnect/revoke
  evidence explicit for release candidates; this does not claim that evidence.

### Before claiming a runnable app or stable release

- Generate the pinned bridge 0.3 binaries and verify the checked-in hosts on
  physical devices through QR → fingerprint → Iroh → one-use grant.
- Physical iOS/Android pairing, forwarder, secure-storage and reconnect/revoke
  evidence.
- A concrete minimal cross-platform local database starter; identity keys and
  bearer secrets must stay in platform secure storage.
- An accurate clean-clone guide and freshly run release gates.
- Native BLE, platform mDNS permissions and device/network measurements remain
  unimplemented; Bluetooth data transport is explicitly a no-go (bootstrap only).
- The opt-in real two-node Iroh test is skipped unless native/runtime fixtures
  are supplied. No stable tag or npm publish is being made.

### Current recommendation

Publishing this source as a pre-alpha component repository is reasonable after
reviewing [publishing readiness](./docs/operations/PUBLISHING-READINESS.md). Do not
present it as a production-ready or immediately runnable desktop/mobile app;
the pinned native binaries still need to be generated with Rustup.
Node-to-node transport remains optional and is not a prerequisite for the first
desktop/mobile flow.

Initial CI evidence:
<https://github.com/gordo-labs/sovereign-apps/actions/runs/31096384990>.

The release gate is `pnpm release:gates`. It does not tag, publish, or promote
this pre-alpha repository.

SA-012 now supplies the native support matrix, sanitized evidence schema,
operator runbook, and cross-OS workflow. Physical iOS/Android and native
artifact evidence are intentionally still blocking; see
[`docs/operations/NATIVE-RELEASE-OPERATIONS.md`](docs/operations/NATIVE-RELEASE-OPERATIONS.md).

Relay self-hosting and custom-only relay profiles are now specified as V1 PRs
V1-14–V1-17; the current host adapters do not yet support a complete custom-
only profile. An optional local-AI MCP server is documented as a post-V1,
selectable module with scoped authorization and six PR-sized tasks; no MCP
runtime is implemented or shipped. See
[`docs/architecture/RELAY-OPERATIONS.md`](docs/architecture/RELAY-OPERATIONS.md) and
[`docs/architecture/MCP-INTEGRATION.md`](docs/architecture/MCP-INTEGRATION.md).
