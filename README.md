# Sovereign Apps

An open-source, pre-alpha monorepo of reusable modules and examples for
application-neutral desktop-to-mobile pairing and Iroh communication.

> This repository is a **pre-alpha component template**. A minimal Electron
> pairing host and iOS/Android React Native host are included. QR scan/deep-link
> pairing exchanges a one-use grant over Iroh. The optional 0.3 TCP-forwarder
> adapter and Electron extra-stream receiver are implemented with contract
> tests. The mobile host pins public bridge source 0.3.0 because npm is still
> at 0.2.0; native bridge binaries must be built locally with Rustup before the
> host can run. This environment lacks those cross-compilation targets.
> Physical-device proof, secure grant persistence and a database starter remain
> open.

## Run the pairing example

Requirements: Node.js 22.12.x, pnpm 9.15.x, Xcode/CocoaPods for iOS, or the
Android SDK for Android, plus Rustup targets for the native bridge build. Clone
with `--recurse-submodules` (or initialize the public bridge submodule first).
Expo Go is not supported.

```sh
git submodule update --init --recursive
pnpm install
pnpm build
pnpm --filter @sovereign-apps/electron-app electron
```

In a second terminal, launch the mobile host on a simulator or device:

```sh
pnpm --filter @sovereign-apps/mobile-example bridge:install
pnpm --filter @sovereign-apps/mobile-example bridge:ios
pnpm --filter @sovereign-apps/mobile-example ios
# or
pnpm --filter @sovereign-apps/mobile-example bridge:android
pnpm --filter @sovereign-apps/mobile-example android
```

For iOS, install pods after `bridge:ios` with
`cd apps/mobile/ios && pod install`. Open the desktop QR in the mobile app,
confirm the displayed fingerprint, and pair. Bridge 0.3 native artifacts are
generated locally and are not checked into the submodule. See the [mobile host
guide](apps/mobile/README.md) and [bridge integration notes](docs/BRIDGE-INTEGRATION.md).

## Intended modules

| Surface                            | Intended responsibility                                    | Current reality                                                                                 |
| ---------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `@sovereign-apps/protocol`         | Neutral framing, pairing, auth, capabilities               | Validated envelopes, one-use sessions and grant contracts with positive/negative tests          |
| `@sovereign-apps/electron-app`     | Desktop Iroh endpoint and pairing example                  | Displays a live bootstrap QR, accepts a mobile request, consumes its session and issues a grant |
| `@sovereign-apps/react-native-app` | Mobile QR client and Iroh bridge adapter                   | Scans/opens pairing data, verifies fingerprint, dials desktop and accepts a peer-bound grant    |
| `@sovereign-apps/web-presence`     | Installable signed-presence helper with framework adapters | Framework-neutral core plus Next.js route factories                                             |
| `apps/landing`                     | Minimal host integration for `web-presence`                | Neutral Next.js web-presence example, not a product/marketing landing                           |

## Target architecture

The stable template should separate five concerns so adopters can select only
the modules they need:

1. identity and key storage;
2. discovery/bootstrap (QR, mDNS/LAN, later BLE or other local channels);
3. authenticated pairing and capability grants;
4. transport adapters (initially Iroh QUIC); and
5. application-owned messages above the transport.

The example flow is desktop QR display → mobile camera scan or pairing link →
fingerprint confirmation → mobile outbound Iroh dial → one-use session proof
and peer-bound grant over the bidirectional framed channel. It is covered by
in-process tests; physical iOS/Android verification is still required.

The React Native bridge is an outbound dialer; there is no mobile incoming
server mode. See the [bridge integration contract](./docs/BRIDGE-INTEGRATION.md).
Node-to-node transport is an optional composable module, not a prerequisite for
the initial desktop/mobile flow.

## Current validation

The repository gates cover frozen install, format, lint, typecheck, build,
tests, contract E2E, release audit and package dry-run. They exercise protocol,
adapter contracts and in-process fixtures; they do not prove physical
desktop-to-phone pairing. Re-run them before a release candidate.

See [current publishing readiness](./docs/PUBLISHING-READINESS.md),
[bridge integration](./docs/BRIDGE-INTEGRATION.md), and the
[historical baseline audit](./docs/AUDIT-2026-08-06.md).

## Architecture

See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for module boundaries and
the planned pairing sequence. The repository's former `working/` planning
folder is local-only and excluded from Git; public setup and release guidance
lives under `docs/`.

No roadmap item is represented as implemented until its acceptance checks pass.

## Provenance

The implementation is application-neutral and uses the public
[`iroh-react-native-bridge`](https://github.com/gordo-labs/iroh-react-native-bridge).
Keep application-specific behavior out of the shared modules and preserve
required license notices.

## License

[MIT](./LICENSE) © 2026 Gordo Labs.
