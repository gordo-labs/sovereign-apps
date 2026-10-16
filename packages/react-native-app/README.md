# Sovereign React Native pairing example

`App.tsx` demonstrates the user flow: scan a desktop QR or open its pairing
link, verify the desktop fingerprint, then establish an Iroh channel. The mobile
client sends the QR's short-lived, one-use session reference over that encrypted
channel and accepts a grant bound to the authenticated Iroh peer. The QR parser
accepts `sovereign://pair?...` and web links such as
`https://your-app.example/pair?...`; the text field is a testing fallback.

The checked-in host is `apps/mobile`; it links this package, the camera module,
camera permissions, and the `sovereign://pair` deep-link scheme. The current
published bridge (0.2.0) supports the framed pairing channel. This package also
feature-detects bridge 0.3's optional TCP forwarder, and Electron validates and
adapts its extra streams to an app-owned loopback service. The HTTP health-check
example is enabled automatically when bridge 0.3+ is installed. See the
[host guide](../../apps/mobile/README.md) and
[bridge integration status](../../docs/BRIDGE-INTEGRATION.md).

The camera package is already wired into the host. Rebuild the native app after
installing dependencies; the OS prompts for camera access when scanning.

```sh
pnpm install
cd apps/mobile/ios && pod install
```

Expo Go is not sufficient for the native bridge or camera module; use a native
React Native build or simulator.

The node-to-node transport remains an optional composable module and is not
required by this pairing example.
