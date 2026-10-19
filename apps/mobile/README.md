# Mobile pairing host

This is the checked-in React Native host for the reusable pairing UI in
`@sovereign-apps/react-native-app`. It supplies the native iOS/Android shell,
camera permission, QR scanning and `sovereign://pair` link registration.
The native bridge source is pinned as a public Git submodule at
`vendor/iroh-react-native-bridge` because the npm registry still publishes only
bridge 0.2.0; the host uses bridge source 0.3.0.

## Requirements

- Node.js 22.22.2 (the repository `.nvmrc`; supported range is `>=22.12 <23`) and pnpm 9.15.x.
- Xcode and CocoaPods for iOS; Android Studio/SDK for Android.
- Rustup with the iOS/Android Rust targets; Homebrew Rust alone cannot
  cross-compile the native bridge.
- A native rebuild. Expo Go cannot load the Iroh TurboModule or camera module.

## Run

From the repository root:

```sh
git submodule update --init --recursive
pnpm install
pnpm --filter @sovereign-apps/mobile-example start
```

Build the pinned bridge's native artifact for the platform you need. This
generates ignored files inside the submodule and must be repeated after a fresh
clone:

```sh
pnpm --filter @sovereign-apps/mobile-example bridge:install
pnpm --filter @sovereign-apps/mobile-example bridge:ios
# or
pnpm --filter @sovereign-apps/mobile-example bridge:android
```

Then run one platform in another terminal:

```sh
pnpm --filter @sovereign-apps/mobile-example ios
# or
pnpm --filter @sovereign-apps/mobile-example android
```

For iOS, run `cd apps/mobile/ios && pod install` after building the bridge and
again whenever its native artifacts change. On Android, start an emulator or
connect a device with USB debugging enabled.

Run the desktop host separately with
`pnpm --filter @sovereign-apps/electron-app electron`. Scan its QR, compare the
fingerprint shown on both screens, and confirm on mobile. The optional loopback
HTTP health check uses the pinned bridge 0.3 source and is available after its
native artifacts have been generated and linked. The public npm package remains
0.2.0 and is not used by this host.

This repository does not yet claim a physical-device test result, durable
mobile grant storage, or a database starter.
