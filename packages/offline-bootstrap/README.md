# `@sovereign-apps/offline-bootstrap`

Optional offline handoff adapters for the single SA-005 pairing envelope. Deep links, file/share and NDEF only carry the bounded, expiring, one-time pairing artifact; they do not authenticate a peer or transport application data. The host must show the artifact to the user, require confirmation, and then run the existing signed pairing transcript and route selection.

This package does not claim desktop NFC support. Inject a maintained iOS/Android NDEF host adapter when platform support is available; otherwise use `createUnavailableNfcAdapter` and surface the reason in diagnostics. Never log or put raw artifact bytes in a clipboard.
