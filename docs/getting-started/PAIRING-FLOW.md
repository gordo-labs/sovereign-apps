# How desktop and mobile pair

This is the best place to start if you want to understand what Sovereign Apps
is trying to make reusable. The reference flow connects one Electron desktop
app to one React Native mobile app. It is an example of an app-to-app channel,
not a user account system, hosted backend, or general-purpose remote-control
feature.

## The experience, step by step

1. **Desktop prepares a temporary invitation.** The desktop creates a short-
   lived pairing session and displays its connection details as a QR code.
2. **The phone receives the invitation.** The user scans the QR with the mobile
   camera or opens the equivalent pairing link.
3. **The user confirms the peer.** The mobile app shows the desktop identity
   fingerprint for confirmation. Scanning is only a way to exchange connection
   details; it does not, by itself, establish trust.
4. **The apps connect.** The mobile app opens the Iroh connection to the
   desktop. The channel is bidirectional once it is established, even though
   the mobile side initiates it.
5. **The apps prove the pairing request.** The mobile sends the one-use session
   reference through the encrypted channel. The desktop checks it against the
   connected peer and issues a peer-bound grant.
6. **The app may exchange its own messages.** The channel is transport for
   application-owned services. The template does not prescribe what an app
   should do with those messages.

Discovery and routing only help the apps find a path. They are not authorization
decisions. Iroh may connect directly or use a relay, depending on network
conditions and endpoint configuration. Read [system architecture](../architecture/ARCHITECTURE.md)
for boundaries, and [relay operations](../architecture/RELAY-OPERATIONS.md) if
you want to understand or operate the relay component.

## What the reference proves — and what it does not

The repository includes an in-process pairing contract and example desktop and
mobile hosts. Automated contract tests cover the modeled exchange. This is not
the same as proving a clean native build or a successful real-phone pairing.
At the current pre-alpha stage, iOS/Android native artifacts and physical
device evidence are still release gaps; secure grant persistence and a minimal
database starter are also outstanding. See [current status](../../STATUS.md)
and the [support matrix](../operations/SUPPORT-MATRIX.md) for exact claims.

Pairing the phone also does not authorize a local AI client. The planned
[MCP module](../architecture/MCP-INTEGRATION.md) has a separate user-approval
and capability-grant flow.

## Try the reference apps

### Requirements

- Node.js 22.12.x and pnpm 9.15.x.
- A clone including the `iroh-react-native-bridge` Git submodule.
- For iOS: Xcode and CocoaPods.
- For Android: Android SDK and a configured emulator/device.
- Rustup targets needed by the pinned native bridge build.

Expo Go is not supported. Native bridge artifacts are generated locally and
are not committed to the public repository.

### Build the shared workspace and desktop host

```sh
git submodule update --init --recursive
pnpm install
pnpm build
pnpm --filter @sovereign-apps/electron-app electron
```

### Build and launch the mobile host

For iOS:

```sh
pnpm --filter @sovereign-apps/mobile-example bridge:install
pnpm --filter @sovereign-apps/mobile-example bridge:ios
cd apps/mobile/ios && pod install
cd ../..
pnpm --filter @sovereign-apps/mobile-example ios
```

For Android:

```sh
pnpm --filter @sovereign-apps/mobile-example bridge:install
pnpm --filter @sovereign-apps/mobile-example bridge:android
pnpm --filter @sovereign-apps/mobile-example android
```

With both hosts running, display the desktop QR, scan it from the phone, verify
the fingerprint, and complete pairing. The commands describe the intended
setup; a failure to generate native bridge artifacts is a known pre-alpha
limitation, not a successful build result.

For host-specific details, see the [Electron host package](../../packages/electron-app/)
and [mobile app](../../apps/mobile/README.md) guide. To understand the code
contract between them, continue to the [bridge integration notes](../architecture/BRIDGE-INTEGRATION.md).
