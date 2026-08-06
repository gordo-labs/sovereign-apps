# BLE feasibility and threat note

SA-014 deliberately ships contracts and a testable wire codec, not a promise
that every desktop/mobile pair can advertise in the background. The host must
select and document the native adapter actually tested on each release.

| Platform | Central | Peripheral | Constraints |
| --- | --- | --- | --- |
| iOS | CoreBluetooth foreground; background scan is restricted | CoreBluetooth foreground; background advertising is restricted | permission and lifecycle state are explicit; no always-on claim |
| Android | Bluetooth LE APIs, subject to runtime permissions | Bluetooth LE advertising where hardware/permission allow | Android version, nearby-device permissions and OEM background policy vary |
| macOS | CoreBluetooth adapter can be injected | CoreBluetooth adapter can be injected | entitlements/permissions and app lifecycle apply |
| Windows | WinRT Bluetooth APIs can be injected | WinRT peripheral support is hardware/OS dependent | adapter must report unsupported role instead of faking it |
| Linux | BlueZ central/peripheral support depends on adapter and daemon | BlueZ peripheral support depends on adapter/daemon | no bundled desktop implementation or universal support claim |

BLE is a user-mediated bootstrap channel. Device name, address, RSSI and
proximity are untrusted hints. Only the existing authenticated SA-005
transcript establishes trust. Every transfer uses an ephemeral transfer ID,
bounded fragments, sequence/length checks, SHA-256 integrity, timeout,
cancellation and cleanup. Replay, spoofed advertisements, duplicate devices,
disconnects, denied permission and Bluetooth-off states must fail closed.

BLE carries bootstrap material only. Application traffic remains on the
selected Iroh/direct/relay route; this module is not a BLE bulk-data transport.
