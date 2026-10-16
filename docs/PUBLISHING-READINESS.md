# Publishing readiness

Reviewed 2026-10-16 against the current Sovereign Apps source and the public
React Native Iroh bridge package/source.

## What is implemented

- The Electron example starts an Iroh responder, builds a short-lived pairing
  envelope from its current bootstrap addresses and displays it as a QR.
- The React Native example accepts the QR through camera scan or deep link,
  asks the user to confirm the desktop fingerprint, and dials the desktop.
- The first encrypted framed message carries the one-use pairing reference and
  the mobile node ID. Electron checks it against the Iroh-authenticated peer,
  consumes the reference once and returns a peer-bound short-lived grant.
- In-process tests cover the pairing session, identity binding, grant acceptance
  and replay rejection. Node-to-node remains optional.
- Minimal checked-in Electron and React Native iOS/Android hosts are available;
  the mobile host includes camera permissions and `sovereign://pair` links.
- The optional bridge 0.3 TCP-forwarder integration and Electron extra-stream
  receiver are implemented and contract-tested. Electron exposes a loopback-
  only `/health` sample service after a peer receives a pairing grant.
- The mobile host pins public bridge source 0.3 as a Git submodule because npm
  still distributes 0.2.0. Platform artifacts must be built locally with
  Rustup before CocoaPods/Gradle; they are not committed.

## Before calling it a runnable user template

1. Test the checked-in hosts through QR → scan → fingerprint confirmation →
   Iroh dial → grant on physical devices; current automated tests are in-process.
2. Generate bridge 0.3 native artifacts with Rustup, then verify its forwarder
   and Electron's `/health` receiver end to end on iOS and Android.
3. Add an iOS Keychain/Android Keystore adapter and persist/revoke grants safely.
4. Add the minimum local database adapter and an app-owned example schema.
5. Re-run all release gates under supported Node 22 and record device evidence
   separately from in-process tests.

The repository can be published as a public pre-alpha component/template source
now that the existing checks pass. That is distinct from claiming a clone-and-
run native app or production-ready connection flow. Do not create a release tag
or publish packages as stable until the native host and device checks above
pass.

The local `working/` directory is intentionally excluded from Git. Public
installation and contribution guidance is in the tracked `docs/` tree.
