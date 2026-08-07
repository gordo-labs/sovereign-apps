# Support matrix

Updated after the integration pass. “Contract” means compile-time/API coverage;
runtime and physical evidence are listed separately.

| Capability | Contract | Implemented adapter | Evidence |
| --- | --- | --- | --- |
| Identity and key storage | yes | Electron file-backed identity; RN injected secure-store boundary | `electron-app/src/node-key.ts`, `react-native-app/src/secure-store.ts` |
| Secure grant storage | yes | desktop authority + RN secure-store boundary | `protocol/src/secure-pairing.ts` |
| Discovery and bootstrap | yes | Electron DNS-SD advertiser; RN browser adapter | `electron-app/src/lan-discovery.ts`, `react-native-app/src/lan-discovery.ts` |
| Transport endpoint/session/framed stream | yes | Electron real Iroh adapter; RN published bridge adapter | `electron-app/src/iroh-node.ts`, `react-native-app/src/transport-adapter.ts` |
| Pairing/auth/trust | yes | protocol + desktop authority + RN boundary; contract E2E | `protocol/src/secure-pairing.ts`, `test/e2e/contract.test.mjs` |
| Route policy and health | yes | deterministic policy package | `packages/route-policy` |
| App codec/capabilities | yes | no | `module-kernel/src/types.ts` |
| Diagnostics | yes | no | `module-kernel/src/types.ts` |
| Composition validation | yes | registry | `module-kernel/test/kernel.test.ts` |
| Adapter conformance helpers | yes | in-memory tests only | `module-kernel/src/conformance.ts` |
| LAN mDNS/DNS-SD | target contract | desktop advertise + iOS/Android browse (permission injected) | `protocol/src/lan-discovery.ts` |
| QR / desktop Iroh / RN Iroh | yes | implemented adapters; real two-node/physical fixture pending | `packages/electron-app`, `packages/react-native-app` |
| Web presence / Next.js example | yes | framework-neutral package + minimal Next.js example | `packages/web-presence`, `apps/landing` |
| BLE bootstrap | contract | platform-neutral codec + in-memory adapter only | `packages/ble-bootstrap` |
| Offline bootstrap | contract | deep-link/file/NFC handoff boundaries + tests | `packages/offline-bootstrap` |
| Bluetooth framed data | explicitly not supported | no native adapter; no physical matrix | `docs/ADR-015-bluetooth-transport.md` |

No row marked “implemented adapter” is promoted to stable-supported until a
platform-specific agent supplies fresh runtime/physical evidence.

Machine-readable evidence consumed by release documentation lives in
[`support-evidence.json`](./support-evidence.json). It contains no credentials,
private endpoints, device identifiers, or QR screenshots.

SA-012 expands the platform/build decision and physical evidence contract in
[`NATIVE-RELEASE-OPERATIONS.md`](./NATIVE-RELEASE-OPERATIONS.md) and the
machine-readable [`release/support-matrix.json`](../release/support-matrix.json).
Desktop rows mean a clean package build only; iOS/Android rows cannot become
stable-supported without all eight physical cases and a signed, fresh manifest.

Bluetooth data is intentionally absent from the supported-module set. Its
verified payload limit is zero until [ADR-015](./ADR-015-bluetooth-transport.md)
is reopened with physical evidence.
