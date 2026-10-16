# V1 delivery plan

This is the detailed companion to the [V1 backlog in the root README](../README.md#v1-delivery-backlog). It defines the smallest reviewable contributions that together take Sovereign Apps from pre-alpha to a stable desktop/mobile template. Each task should be a separate PR; do not close an item based on mocks when its acceptance criteria require a native build or physical evidence.

## Shared PR rules

- Put the task ID (for example, `V1-04`) in the PR title and description.
- Keep the diff scoped to that task. Split unrelated refactors and follow-up work into separate PRs.
- Include tests for behavior changes, update the relevant README/status/support docs, and report the exact commands and platforms tested.
- Never include credentials, QR contents, private addresses, raw device identifiers, or generated bridge binaries in a PR.
- A task with a dependency can be prepared in parallel, but cannot be marked complete until its dependency is merged and its own acceptance checks pass.
- Record physical results with `scripts/release/record-evidence.mjs`; `skipped` or `blocked` is not a passing result.

## V1-01 — Reproducible bridge build

**Scope:** make the public bridge source pinned in `vendor/iroh-react-native-bridge` reproducibly generate the iOS and Android artifacts required by its native module. Keep generated artifacts ignored and outside the Git link.

**Done when:** a documented, scripted clean setup pins Rustup/toolchain/targets and bridge commit; both platform artifacts build from source; output checksums and versions can be recorded; repeating the process on a clean checkout yields the same declared versions. Do not switch to a newer npm package unless its published version and native APIs are verified.

**Dependencies:** none.

## V1-02 — iOS host build

**Scope:** build and launch only `apps/mobile` for the declared iOS simulator using the pinned bridge and camera dependency.

**Done when:** clean `bundle`/CocoaPods install and Xcode simulator build pass on the documented toolchain; the app launches, camera permission is correctly described, and `sovereign://pair` opens the pairing screen; no local signing credentials or generated binaries are committed.

**Dependencies:** V1-01.

## V1-03 — Android host build

**Scope:** build and launch only `apps/mobile` for the declared Android emulator using the pinned bridge and camera dependency.

**Done when:** clean Gradle-wrapper build and emulator install pass on the documented JDK/SDK; camera permission and `sovereign://pair` intent work; no local signing credentials or generated bridge binaries are committed.

**Dependencies:** V1-01.

## V1-04 — Mobile secure storage

**Scope:** provide a concrete iOS Keychain and Android Keystore-backed implementation of the existing secure-store boundary. Keep the public API small enough to replace by adopters.

**Done when:** store/read/delete behavior is tested on both OSes and through unit tests; app identity/grant secrets survive process restart; secrets never enter SQLite, logs, QR payloads after pairing, AsyncStorage, or ordinary preferences; failure and device-lock states are surfaced without silently creating a new identity.

**Dependencies:** V1-02 and V1-03.

## V1-05 — Grant lifecycle

**Scope:** connect the secure-store adapter to pairing so grants have explicit expiry, reconnect, revoke and teardown semantics in both hosts.

**Done when:** automated protocol/host tests prove one-use QR consumption, peer binding, valid reconnect, expiry denial, explicit revoke denial, and cleanup of sessions/listeners; UI reports paired, reconnecting, expired and revoked states without exposing bearer material.

**Dependencies:** V1-04.

## V1-06 — iOS physical pairing evidence

**Scope:** validate the initial desktop-to-iPhone path on a physical iOS device and record the required release cases.

**Done when:** every `mandatoryCases` entry in `release/support-matrix.json` passes on the supported iOS device/OS classes: QR first pair, bidirectional message, direct Wi-Fi, relay, network transition, background/foreground, restart and revoke/teardown. Attach sanitized evidence for the exact tested commit; failures remain visible and are not replaced by simulator output.

**Dependencies:** V1-02, V1-04 and V1-05.

## V1-07 — Android physical pairing evidence

**Scope:** validate the same desktop-to-phone flow on physical Android and record the required release cases.

**Done when:** every `mandatoryCases` entry passes on the supported Android device/OS classes, with sanitized evidence tied to the exact tested commit. Keep emulator-only results labeled as emulator evidence.

**Dependencies:** V1-03, V1-04 and V1-05.

## V1-08 — iOS optional stream forwarder

**Scope:** verify bridge 0.3 `startTcpForwarder()` and Electron's extra-stream receiver as an optional adapter; do not make this adapter necessary for ordinary framed pairing.

**Done when:** on an iOS simulator and physical device, a successfully granted peer reaches only the loopback `/health` sample; unknown preambles, non-loopback targets, pre-grant streams, cancellation and disconnect are rejected/cleaned up. Preserve contract tests and label simulator versus device evidence.

**Dependencies:** V1-02 and V1-05.

## V1-09 — Android optional stream forwarder

**Scope:** verify the same optional stream-forwarder contract on Android without changing the core pairing protocol.

**Done when:** V1-08's valid and negative cases pass on Android emulator and physical device; forwarding remains loopback-only and listeners/resources stop on revoke or disconnect.

**Dependencies:** V1-03 and V1-05.

## V1-10 — Minimal local database

**Scope:** add a small versioned SQLite module/example for application-owned non-secret records and paired-peer metadata. Decide the SQLite libraries and migration policy in the PR; keep platform-specific storage behind one typed interface.

**Done when:** a fresh install and each migration path are tested on Electron, iOS and Android; example schema is documented; migration failure has a defined recovery behavior; private identity keys and grants are stored only through V1-04 secure storage.

**Dependencies:** V1-04.

## V1-11 — Selectable project generator

**Scope:** extend `create-sovereign-app` to generate the minimal Electron and React Native hosts and let a new project opt into or omit optional modules independently.

**Done when:** automated tests generate at least the default desktop+mobile project and one reduced project; generated outputs install and build in a clean temporary directory; omitted modules leave no imports, permissions, package dependencies or startup code; generated names/copy are neutral and do not reference a consuming product.

**Dependencies:** V1-02, V1-03 and V1-10.

## V1-12 — Clean-clone and CI gates

**Scope:** automate reproducible repository and generated-project checks, including native simulator/emulator builds where runners support them.

**Done when:** documented clean-clone commands pass with the pinned Node/pnpm and submodule; CI runs frozen install, format, lint, typecheck, tests, contract E2E, package install tests, generator smoke test, iOS simulator build and Android emulator build. Physical-only cases remain explicit operator evidence requirements; no missing tool/device is silently treated as success.

**Dependencies:** V1-01, V1-02, V1-03 and V1-11.

## V1-13 — Security and V1 release review

**Scope:** perform the release-focused threat-model, dependency/license, API compatibility, support-matrix and documentation review. Fixes that exceed a small isolated change become their own PRs referencing this task.

**Done when:** pairing/auth and local data-flow docs match the code; all public modules state guarantees and non-goals; dependency/license audit findings are resolved or documented; `release/support-matrix.json` reflects only tested claims; fresh required physical evidence exists for both mobile platforms; all release gates pass from a clean clone; maintainers explicitly approve the `1.0.0` release checklist.

**Dependencies:** V1-05, V1-06, V1-07, V1-10, V1-11 and V1-12. The optional V1-08/V1-09 stream-forwarder work is not a core V1 release blocker.

## V1 release boundary

V1 means a reproducibly buildable Electron + iOS + Android starter with QR/deep-link pairing, user-confirmed desktop identity, authenticated bidirectional application messages, secure grant persistence and revocation, a minimal local database example, and a generator that can omit optional modules. Only platforms with fresh evidence may be advertised as supported.

Web presence, BLE/offline bootstrap, Bluetooth data transport, and node-to-node examples remain optional modules. They are not prerequisites for desktop-to-mobile V1; Bluetooth data transport remains explicitly unsupported until its separate ADR exit criteria and physical evidence are satisfied.
