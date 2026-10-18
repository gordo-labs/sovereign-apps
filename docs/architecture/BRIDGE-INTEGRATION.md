# React Native Iroh bridge integration

The bridge is a transport module, not an application pairing or authentication
system. Its public source is [gordo-labs/iroh-react-native-bridge](https://github.com/gordo-labs/iroh-react-native-bridge).

## Current dependency and working flow

- The public npm package is still `@gordo-labs/react-native-iroh@0.2.0`.
- The checked-in mobile host uses the bridge's public Git submodule pinned to
  source commit `3d9ec4055497e04e7e66e783cff7600721e479c6` (`0.3.0`). This avoids
  pretending the registry's 0.2.0 package contains the newer native API.
- The mobile example uses its endpoint, outbound dial, session and framed-stream
  APIs; the Electron app accepts the peer session and exchanges pairing messages
  on that stream.
- A desktop QR contains a short-lived one-use pairing reference and bootstrap
  address. Mobile verifies the desktop fingerprint, dials the Iroh peer, and
  sends the reference over the encrypted channel. Electron binds the grant to
  the Iroh-authenticated mobile node identity and consumes the reference once.
- The mobile camera and deep-link routes share the same QR parser. Manual JSON
  entry is a testing fallback only.

## Bridge 0.3 source capabilities and runtime availability

Public bridge source `0.3.0` adds `startTcpForwarder()` for loopback TCP-to-QUIC
forwarding and async dial diagnostics. This repository now includes the
optional mobile adapter, a neutral stream preamble, and an Electron extra-stream
receiver that forwards to a loopback-only HTTP health service. The receiver
registers only after the one-use pairing grant succeeds. Contract tests cover
target selection, lifecycle, preamble checking and loopback forwarding.

The 0.3 source is present, but its platform binary artifacts are generated
locally and are not tracked in the bridge submodule. Run the host's
`bridge:install` and platform build script before CocoaPods/Gradle. This machine
does not currently have Rustup cross-compilation targets installed, so the
native archive and `/health` flow could not be built or tested here. The npm
0.2.0 package also fails iOS linking due to missing UniFFI symbols; do not use
it as a fallback. Physical iOS/Android verification remains required. Keep
`dialDiagnostics()` diagnostic-only; it must not gate pairing.

## Relay configuration status

The pinned React Native bridge currently starts its endpoint with
`RelayMode::Default`; `connectTarget` can include a peer's relay URL, but the
bridge API does not yet expose a startup custom relay map. The Electron native
dependency accepts custom relay URLs, but the Sovereign Electron adapter
currently passes only the mode, not the URL list. Therefore this template
cannot yet claim a custom-only/self-hosted relay setup or prove that no public
relay/discovery service was used. The required API and integration tasks are
defined in [`RELAY-OPERATIONS.md`](./RELAY-OPERATIONS.md). Do not treat adding a
URL to the QR alone as configuration of both Iroh endpoints.

## Address and trust rules

The mobile adapter combines usable direct addresses and a relay URL for one
node into a single typed target. A candidate set must identify one node; the
adapter rejects conflicting node IDs, ambiguous tickets, malformed addresses,
and multiple relay URLs. A relay is never treated as a direct socket.

Iroh authenticates and encrypts the transport peer. Pairing separately binds
the one-use QR reference to that peer and issues an application grant. Neither
reachability nor ALPN alone is an application authorization decision. The
grant must be validated before protected application operations are exposed.

## Native host requirements

`apps/mobile` is the checked-in native host. It enables React Native New
Architecture, autolinks the TurboModule and camera package, registers the
camera permission and `sovereign://pair` deep-link scheme, and needs the pinned
bridge's generated artifacts before its iOS CocoaPods install or Android Gradle
build. Expo Go cannot load these native modules.
