# SA-001 dependency decisions

Recorded 2026-08-06 for the reproducible-workspace gate.

## Supported toolchain

- Node.js: `22.22.2` (`.nvmrc`, and `engines.node >=22.12 <23`).
- pnpm: `9.15.9` (`packageManager`, `engines.pnpm >=9.15.9 <10`, CI action).
- The committed `pnpm-lock.yaml` was generated with pnpm `9.15.9`.

The repository must be installed with `pnpm install --frozen-lockfile`. Corepack
is recommended where available; `npx pnpm@9.15.9` is a public fallback for
machines where Corepack is not bundled.

## Published React Native bridge

`@sovereign-apps/react-native-app` consumes the public
`@gordo-labs/react-native-iroh@^0.2.0`. It is not copied into this repository,
referenced through a sibling path, or resolved from a private registry. npm
reports the bridge peer `react-native >=0.81` and dependency `@ubjs/core`.
`npm pack --dry-run --json` reports 42 files, a compressed tarball of about
**77 MB**, and an unpacked size of approximately **230 MB**. The payload
includes iOS `xcframework` static libraries and Android ABI `.so` files. This
size is expected and must be called out in release/storage planning rather than
worked around by vendoring or silently pruning native files.

React Native `0.81` is paired with React `19.1` and `@types/react` `19`, matching
the first-party peer line. This only makes dependency resolution coherent; it
does not claim that the native app or bridge is functional before SA-004.

## Native install policy

The bridge contains native code. A consumer must run the platform's native
dependency installation and rebuild steps after installing the JavaScript
package (CocoaPods on iOS and the Gradle/Android build on Android). It cannot
run inside Expo Go because Expo Go cannot load this custom native module; use a
development build or a bare React Native application. Native build scripts are
not run by the anonymous workspace CI job at SA-001.

The workspace's `pnpm-workspace.yaml` keeps build policy explicit for native
packages. No `allow-scripts` wildcard is permitted; any future native package
must be reviewed and added by name with a reason.

## Verification record

Commands run for this task:

```text
npx --yes pnpm@9.15.9 --version                 # 9.15.9
npx --yes pnpm@9.15.9 install --frozen-lockfile --ignore-scripts
npx --yes pnpm@9.15.9 list --depth 0 --recursive
npm view @gordo-labs/react-native-iroh@0.2.0 version peerDependencies dependencies dist.unpackedSize --json
```

The clean-install gate is intentionally separate from runtime claims. Protocol,
native, pairing and end-to-end tests remain scheduled in SA-002 through SA-006.
