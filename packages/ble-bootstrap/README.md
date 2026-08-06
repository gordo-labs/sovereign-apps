# `@sovereign-apps/ble-bootstrap`

Optional BLE bootstrap only. It transfers a bounded, already-authenticated
SA-002/SA-005 bootstrap envelope; it is not an identity protocol or a bulk data
transport. BLE names, addresses and RSSI are never identity. Hosts must show
discovered devices, obtain explicit confirmation, run the normal authenticated
pairing transcript, then hand the resulting candidates to route policy/Iroh.

The package ships platform-neutral fragmentation/reassembly and adapter
contracts. `createUnavailableAdapter()` is intentionally honest: no native BLE
implementation is bundled. Host applications inject CoreBluetooth,
Android-Bluetooth, or a desktop adapter and must report permission/power/
background limitations rather than treating them as connected state.

The GATT service uses ephemeral session hints only:

- service `6f766572-7365-7265-6967-6e2d626c65`;
- write characteristic `6f766572-7365-7265-6967-6e2d777274`;
- notify characteristic `6f766572-7365-7265-6967-6e2d6e6f74`.

No private key, bearer token, reusable grant or application data belongs in
advertisements or characteristics. This package does not claim BLE bulk-data
transport.
