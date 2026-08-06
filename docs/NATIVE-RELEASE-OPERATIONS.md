# Native and desktop release operations

SA-012 is an evidence gate, not a claim that a GitHub runner owns a phone. CI
proves reproducible source builds; an operator proves the physical iOS/Android
path and attaches only sanitized, signed evidence.

## Support decision

The machine-readable source of truth is [`release/support-matrix.json`](../release/support-matrix.json).

| Target | Current decision | What CI can prove | Stable requirement |
| --- | --- | --- | --- |
| macOS arm64/x64 desktop | supported-build | Electron package build on pinned macOS runners | fresh `native-build` pass for each architecture |
| Windows x64 desktop | supported-build | Electron package build on Windows 2022 | fresh `native-build` pass |
| Linux x64 glibc desktop | supported-build | Electron package build on Ubuntu 24.04 | fresh `native-build` pass |
| Physical iOS | supported-physical | only on an authorized macOS host with a checked-in native project | all mandatory cases below, with signed evidence |
| Physical Android | supported-physical | only on an authorized host with Android SDK/device | all mandatory cases below, with signed evidence |
| FreeBSD/other desktop | unsupported | no pinned native artifact or runner | never silently promoted |
| Browser as a QUIC endpoint | experimental | web presence can publish bounded signed records only | not a transport claim |

The current React Native package has no checked-in `ios/` or `android/` host in
this template. The native build runner must therefore record `blocked` and the
manifest must remain red until an adopter supplies the host and its pinned
toolchain. A skipped job is not evidence.

## Pinned toolchain

- Node `22.12.x` and pnpm `9.15.9` (root `package.json`, `.nvmrc`).
- Electron native dependency `@momics/iroh-http-node` `0.6.1`; do not let an
  optional-platform install silently change the lockfile.
- iOS: Xcode version and macOS image are declared by the self-hosted runner;
  Ruby/Bundler and CocoaPods versions must be committed in `Gemfile.lock` once
  the native host is added. Run `bundle exec pod install` from the iOS host.
- Android: JDK, Gradle wrapper, Android Gradle Plugin, compile/target SDK and
  NDK are declared by the native host. Use the wrapper (`./gradlew`), never a
  globally selected Gradle version.
- CI caches pnpm's store only. CocoaPods/Gradle caches may be enabled after the
  lock/wrapper files exist; cache keys include OS, architecture, lockfile hash,
  Xcode/JDK/SDK class and the bridge version. A cache hit never substitutes a
  clean install or a fresh evidence record.

## Operator runbook

Use two freshly installed app instances, one supported desktop and one physical
phone, on a disposable test account. Record a case with:

```sh
node scripts/release/record-evidence.mjs \
  --platform ios-physical --case qr-scan-first-pair --result pass \
  --device-class "iPhone class" --os-class "iOS major.minor class" \
  --attestation path/to/sanitized-device-attestation.json \
  --notes "Observed QR pairing and authenticated session"
```

Run every case for **both** `ios-physical` and `android-physical`; run the
desktop build case for every desktop row:

1. **QR scan / first pair** — start a fresh desktop identity, display a short-
   lived QR, scan on the phone, verify the displayed fingerprint out of band,
   approve once, and record that the first authenticated session opens. Never
   put QR contents, node IDs, addresses or tokens in notes/logs.
2. **Bidirectional message** — send a bounded request desktop→phone and phone→
   desktop; verify correlation, schema validation and no duplicate delivery.
3. **Direct Wi-Fi** — place both devices on the same LAN, observe discovery,
   verify the authenticated direct route, and record route class only.
4. **Relay** — disable direct reachability without changing trust, verify the
   Iroh relay route, and verify the same authorization is retained.
5. **Network transition** — move Wi-Fi↔cellular or between LANs; verify route
   re-selection and reconnect without a second trust grant.
6. **Background/foreground** — background the phone for the supported interval,
   resume it, and verify either an authenticated reconnect or an explicit,
   documented unavailable state (never a false connected state).
7. **Restart** — restart both processes; verify persisted identity, reconnect,
   and no new pairing prompt for the still-trusted peer.
8. **Revoke / teardown** — revoke on the owner, verify new sessions fail on
   both sides, delete temporary state, and confirm no key/QR/token remains in
   the evidence directory.

For each case, attach a sanitized log hash with `--log path/to/sanitized.log`.
The evidence writer rejects sensitive field names and stores only the log
SHA-256. Physical `pass` evidence is rejected unless a sanitized attestation
file is supplied; the manifest also marks legacy/synthetic pass records without
that hash red. Evidence must be generated within the manifest freshness window
(72 hours for stable, 168 hours for CI by default).

## Build and manifest commands

```sh
# CI or a local desktop runner; exits non-zero on failed/blocked build.
SOVEREIGN_EVIDENCE_DIR=artifacts/support-evidence \
  node scripts/release/run-native-build.mjs desktop-linux-x64

# Aggregate CI + operator evidence. A stable run is red when anything is
# missing, stale, failed, unsigned, or physically unverified.
node scripts/release/generate-support-manifest.mjs \
  --channel stable --max-age-hours 72 --require-signature \
  --evidence-dir artifacts/support-evidence \
  --output artifacts/support-manifest.json
```

Set `SOVEREIGN_EVIDENCE_PRIVATE_KEY` only in the release operator's secret
store. It is an Ed25519 PEM key; it is never written to a file or manifest.
The manifest contains the public-key SHA-256 and signature over the canonical
payload. Keep the private key outside the repository and rotate it through the
incident owner.

## Native bridge and incident ownership

When `@gordo-labs/react-native-iroh` changes, refresh the dependency and run a
clean native rebuild; do not patch generated bindings by hand. For CocoaPods,
delete only the host's derived Pods/build state, rerun `bundle exec pod install`,
then repeat the build evidence. For Gradle, use `./gradlew --stop` and the
wrapper's clean task before retrying; preserve the first sanitized failure.

The release owner (the maintainer who holds the signing key) decides whether a
candidate is promoted. The platform operator owns device evidence. The bridge
maintainer owns native binding failures. On an incident, mark the manifest red,
revoke the affected test grant, stop publication, and roll back to the last
manifest whose signature, commit and mandatory matrix were all green. Do not
roll back by deleting evidence; retain failed evidence for the audit trail.
