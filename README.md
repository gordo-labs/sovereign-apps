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
| `@sovereign-apps/mcp-server`       | Optional MCP adapter for app-owned capabilities            | Planned; not implemented or shipped. See [MCP architecture and tasks](./docs/MCP-INTEGRATION.md) |
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

An MCP server is another optional module above the app-service/capability
boundary, not a transport or a pairing authority. The local AI host must be
approved separately and receive narrowly scoped, revocable capabilities; it
must never receive Iroh identity keys or the mobile pairing grant. See the
[MCP architecture and PR-sized plan](./docs/MCP-INTEGRATION.md). This is a
planned module and is not a V1 pairing-release blocker.

### Relay role and self-hosting

The Iroh relay is a fallback/rendezvous transport service, not the app's
backend, identity provider, or pairing authority. Self-hosting lets an adopter
control the relay URL, availability, access policy and metadata exposure, but
does not make relayed packets readable or authorize peers. The template's
current adapters do not yet provide a complete custom-only relay profile, so a
QR that contains a custom relay URL alone does not prove that public relays or
discovery were avoided. See [relay architecture and the self-hosting
plan](./docs/RELAY-OPERATIONS.md).

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
| [V1-13](./docs/ROADMAP.md#v1-13-security-and-v1-release-review) | Complete the security, support-matrix, API, license and release-readiness review. | V1-05–V1-07, V1-10–V1-12, V1-14–V1-17 | Threat model and API/module docs match behavior; dependency/license audit is clean or exceptions documented; self-hosted relay and mobile support evidence is fresh; release checklist passes before `1.0.0`. |
| [V1-14](./docs/RELAY-OPERATIONS.md#v1-14--custom-relay-api-in-the-react-native-bridge) | Add an explicit custom relay map/profile to the pinned React Native bridge in its upstream repository. | — | Versioned native/JS API supports default/custom/disabled modes, validates custom relay URLs, and proves custom-only never silently resolves to Iroh's default relay set. |
| [V1-15](./docs/RELAY-OPERATIONS.md#v1-15--relay-profiles-in-the-sovereign-host-adapters) | Expose matching relay profiles in Electron and React Native host adapters. | V1-14 | Both hosts pass a typed profile to native endpoints; custom requires an explicit non-empty URL list; pairing address carries the intended relay; no secrets are hard-coded. |
| [V1-16](./docs/RELAY-OPERATIONS.md#v1-16--version-pinned-self-host-relay-kit) | Add a minimal, version-pinned `iroh-relay` deployment example and operator runbook. | — | Config/image version is validated; TLS, ports, health, private metrics, limits/access policy, upgrades and rollback are documented; no credentials or product-specific URL is committed. |
| [V1-17](./docs/RELAY-OPERATIONS.md#v1-17--custom-relay-end-to-end-proof) | Prove two app hosts pair and exchange data using only an adopter-managed relay. | V1-02, V1-03, V1-05, V1-14–V1-16 | Repeatable tests cover custom relay route, direct route, relay-only case, outage behavior and no-public-relay/no-n0-discovery proof; iOS/Android evidence is sanitized. |

### V1 exit criteria

Call the repository v1 only when a clean checkout can build the declared
Electron, iOS and Android hosts; QR scan and deep link both complete
fingerprint-confirmed pairing, authenticated bidirectional application
messages, reconnect and revoke; secure storage and the starter database work;
the generator can omit optional modules; an adopter can configure and verify a
self-hosted custom relay without accidental public-relay fallback; and the
required support/evidence and security gates pass. Only platforms with fresh
evidence may be called supported. Web presence, BLE/offline bootstrap,
Bluetooth data transport, multi-region relay failover and node-to-node
examples remain optional modules and are not blockers for this desktop-to-
mobile v1.

To contribute, open one PR per V1 ID, include that ID in the PR title, implement
only its stated scope, and attach its acceptance evidence. V1-08 and V1-09 are
optional and do not block the core desktop/mobile v1. Start branches with
`gordo/` when working in this repository; fork contributors can use their own
branch naming. The detailed task cards and shared evidence rules are in the
[V1 roadmap](./docs/ROADMAP.md), with the relay-specific cards in
[relay operations](./docs/RELAY-OPERATIONS.md).

### Optional post-V1 module: local AI / MCP

This is a separate track, not a V1 pairing gate. Each ID is intended as a
focused PR; [MCP integration](./docs/MCP-INTEGRATION.md) contains acceptance
criteria, security boundaries and copyable agent prompts.

| ID | Atomic PR scope |
| --- | --- |
| MCP-01 | Define and test the app capability registry and MCP tool/resource contract. |
| MCP-02 | Add explicit local AI-client approval and scoped, revocable grants. |
| MCP-03 | Build the optional stdio server and minimal read-only app tools. |
| MCP-04 | If needed, add authenticated Streamable HTTP bound to loopback by default. |
| MCP-05 | Route a scoped MCP capability to mobile-owned services over paired Iroh. |
| MCP-06 | Make MCP selectable in the generator and complete security/operator docs. |

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
