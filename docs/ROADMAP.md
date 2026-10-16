# Public roadmap

This roadmap describes repository work needed to turn the current pre-alpha
component set into a useful starter. It is not a release promise.

## 1. Complete the desktop-to-mobile native example

- Generate the pinned bridge's native artifacts, then run the checked-in
  Electron, iOS and Android hosts on supported physical devices and record QR →
  fingerprint → Iroh → one-use grant evidence.
- Add mobile OS-backed storage, and persist/revoke grants safely.
- Verify bridge 0.3's native forwarder plus Electron's extra-stream receiver
  end to end; contract coverage is present, physical verification is not.
- Exercise disconnect, retry and grant revoke on supported devices.

## 2. Ship a useful local-state starter

- Add a small versioned SQLite schema and migration example for adopter-owned
  application records and paired-peer metadata.
- Keep private keys and bearer tokens in OS-backed secure storage; SQLite stores
  references and non-secret app data only.
- Document the selected Electron and React Native SQLite adapters and their
  backup/migration boundaries.

## 3. Make the template downloadable and reproducible

- Extend the module generator to include the checked-in Electron and React
  Native host projects, with native permissions and bridge setup where selected.
- Add a clean-clone guide that takes a contributor from checkout to two running
  development hosts.
- Keep the generated app neutral and removable: users can include or omit
  web-presence, discovery, route policy and bootstrap modules.

## 4. Verify platform support

- Run QR-to-auth-to-bidirectional-message flows on physical iOS and Android
  devices against the desktop responder.
- Record camera, local-network, secure-storage, reconnect and revoke results.
- Publish support only for the tested OS, React Native and native build matrix.

## Optional communication modules

Direct Iroh, relay fallback, web presence, mDNS and later BLE/offline bootstrap
remain composable modules. Node-to-node examples can be installed independently
and are not required for the initial desktop/mobile pairing path. Bluetooth data
transport remains unsupported until its native implementation and physical
evidence gate passes.
