# ADR-015: Bluetooth remains bootstrap-only

- Status: Accepted no-go for data transport
- Date: 2026-08-06
- Scope: Electron/macOS/Windows/Linux desktop roles with iOS and Android peers

## Decision

Do not ship a Bluetooth framed data transport in the current Sovereign Apps
release. `@sovereign-apps/ble-bootstrap` is an optional, bounded handoff only;
after the authenticated SA-005 transcript, application bytes must use a
verified Iroh/direct/relay route selected by SA-016. No generator, route policy,
support matrix or public API may advertise Bluetooth as a payload transport.

This is a deliberate no-go, not a claim that Bluetooth hardware can never carry
data. The decision is revisited only after a native adapter and physical matrix
meet the exit criteria below.

## Evidence and feasibility gate

The machine-readable matrix is [bluetooth-transport-matrix.json](./bluetooth-transport-matrix.json).
Public operating-system APIs expose GATT on the relevant platforms, but role
symmetry, background execution, MTU/flow-control behavior, L2CAP/Classic
availability and permissions differ by OS and device. The repository contains
no native CoreBluetooth, Android BluetoothGatt, WinRT or BlueZ adapter and no
physical-device measurements. Its only executable BLE pair is an in-memory
test adapter, so it cannot establish throughput, latency, reconnect, background
or long-duration evidence.

Without a measured payload limit, route policy cannot safely choose Bluetooth
for a framed stream: an unverified candidate would either risk unbounded queues
and truncation or require a false universal capability flag. OS bonding would
also not replace the SA-005 app trust root.

## Consequences

- BLE discovery and bootstrap may return an ephemeral, untrusted hint only.
- `verifiedPayloadLimitBytes` is zero; a Bluetooth candidate must be rejected by
  route policy as a data route until this ADR changes.
- No native dependency, background claim, L2CAP/Classic fallback or bulk-data
  module is added. This keeps generated apps honest and avoids shipping a
  transport that has not passed the protocol, auth, backpressure and lifecycle
  contract.
- Existing BLE fragmentation tests remain useful for bootstrap integrity and
  are not evidence of Bluetooth transport support.

## Re-open criteria

An agent may propose a bounded adapter only when all are available:

1. Native adapters for each explicitly claimed desktop/mobile pair, with
   permission, Bluetooth-off, role and foreground/background states surfaced.
2. Physical tests with Wi-Fi/Internet disabled recording MTU, throughput,
   p50/p95 latency, loss/duplicate/reorder, queue bounds, reconnect and a
   long-duration run on every claimed OS/device combination.
3. SA-002 framing and SA-005 authentication/conformance tests over those
   adapters, including malicious frame bounds, cancellation and handoff.
4. SA-016 route cost/size limits that make Bluetooth opt-in and reject payloads
   above the measured limit; diagnostics must never leak addresses or secrets.
5. Updated support matrix, generator manifest, README and release evidence
   naming the exact platform pair and experimental/support status.

Until then, Bluetooth is bootstrap-only by design.
