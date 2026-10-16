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

## V1 delivery backlog

The list below is the public, PR-sized plan for moving this repository from
pre-alpha to its first stable template release. Every row is one task and
should normally be one focused PR. Do not combine unrelated rows; a PR may
prepare a later task, but it must not mark that task done without its own
acceptance evidence. Tasks can be claimed independently unless a dependency is
listed.

| ID | Atomic PR scope | Depends on | Acceptance criteria |
| --- | --- | --- | --- |
| [V1-01](./docs/ROADMAP.md#v1-01-reproducible-bridge-build) | Make the pinned Iroh bridge 0.3 source reproducibly build its ignored iOS and Android artifacts from a clean clone. | — | Document and script the exact Rustup targets/toolchain; clean setup produces both artifacts; generated outputs stay ignored; record bridge commit/version and artifact hashes. |
| [V1-02](./docs/ROADMAP.md#v1-02-ios-host-build) | Make only the checked-in iOS host build/install with the pinned bridge and camera module. | V1-01 | Clean-clone `pod install` and simulator build pass on the declared Xcode version; permissions/deep links are registered; no generated binaries or local secrets are committed. |
| [V1-03](./docs/ROADMAP.md#v1-03-android-host-build) | Make only the checked-in Android host build/install with the pinned bridge and camera module. | V1-01 | Clean-clone Gradle wrapper build and emulator install pass on the declared JDK/SDK; camera permission and `sovereign://pair` intent are registered. |
| [V1-04](./docs/ROADMAP.md#v1-04-mobile-secure-storage) | Implement the concrete iOS Keychain/Android Keystore adapter behind the existing secure-store boundary. | V1-02, V1-03 | Store/read/delete tests pass on both platforms; secrets never enter SQLite, logs, QR payloads after pairing, or ordinary preferences. |
| [V1-05](./docs/ROADMAP.md#v1-05-grant-lifecycle) | Complete grant expiry, reconnect, revoke, and teardown behavior across both hosts. | V1-04 | Automated tests prove valid reconnect, expiry denial, revocation denial, one-use pairing, and resource cleanup; docs describe user-visible states. |
| [V1-06](./docs/ROADMAP.md#v1-06-ios-physical-pairing-evidence) | Run the required pairing/reconnect matrix on physical iOS and submit sanitized evidence. | V1-02, V1-04, V1-05 | All mandatory cases in `release/support-matrix.json` pass; evidence is tied to the tested commit and contains no QR, secret, private address, or device identifier. |
| [V1-07](./docs/ROADMAP.md#v1-07-android-physical-pairing-evidence) | Run the same required matrix on physical Android and submit sanitized evidence. | V1-03, V1-04, V1-05 | All mandatory cases in `release/support-matrix.json` pass; evidence is tied to the tested commit and safely sanitized. |
| [V1-08 — optional](./docs/ROADMAP.md#v1-08-ios-optional-stream-forwarder) | Verify the optional bridge 0.3 TCP-forwarder + Electron extra-stream receiver on iOS. | V1-02, V1-05 | A granted peer reaches only the loopback sample service; invalid preambles, unpaired peers, remote hosts, cancellation and disconnect are rejected/cleaned up on an iOS simulator and device. |
| [V1-09 — optional](./docs/ROADMAP.md#v1-09-android-optional-stream-forwarder) | Verify the same optional stream-forwarder path on Android. | V1-03, V1-05 | The V1-08 checks pass on Android emulator and device; no general-purpose proxy or non-loopback target is exposed. |
| [V1-10](./docs/ROADMAP.md#v1-10-minimal-local-database) | Add one small, versioned SQLite starter for non-secret app data and paired-peer metadata. | V1-04 | Fresh install and migrations work on Electron, iOS, and Android; tests cover upgrade/rollback policy; identity keys and grants remain in secure storage. |
| [V1-11](./docs/ROADMAP.md#v1-11-selectable-project-generator) | Extend `create-sovereign-app` to produce a neutral desktop/mobile starter with individually selectable optional modules. | V1-02, V1-03, V1-10 | A generated project installs and builds from a clean temp directory; omitted modules leave no imports, permissions, or dependencies; generated output contains no product-specific copy. |
| [V1-12](./docs/ROADMAP.md#v1-12-clean-clone-and-ci-gates) | Turn the documented setup into a repeatable clean-clone check and platform CI build gates. | V1-01–V1-03, V1-11 | CI verifies frozen install, all repository gates, generator smoke test, iOS simulator build and Android emulator build; blocked physical tests remain explicitly blocked, never silently skipped. |
| [V1-13](./docs/ROADMAP.md#v1-13-security-and-v1-release-review) | Complete the security, support-matrix, API, license and release-readiness review. | V1-05–V1-07, V1-10–V1-12 | Threat model and API/module docs match behavior; dependency/license audit is clean or exceptions documented; all required support evidence is fresh; release checklist passes before `1.0.0`. |

### V1 exit criteria

Call the repository v1 only when a clean checkout can build the declared
Electron, iOS and Android hosts; QR scan and deep link both complete
fingerprint-confirmed pairing, authenticated bidirectional application
messages, reconnect and revoke; secure storage and the starter database work;
the generator can omit optional modules; and the required support/evidence and
security gates pass. Only platforms with fresh evidence may be called
supported. Web presence, BLE/offline bootstrap, Bluetooth data transport and
node-to-node examples remain optional modules and are not blockers for this
desktop-to-mobile v1.

To contribute, open one PR per V1 ID, include that ID in the PR title, implement
only its stated scope, and attach its acceptance evidence. V1-08 and V1-09 are
optional and do not block the core desktop/mobile v1. Start branches with
`gordo/` when working in this repository; fork contributors can use their own
branch naming. The detailed task cards and shared evidence rules are in the
[V1 roadmap](./docs/ROADMAP.md).

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
