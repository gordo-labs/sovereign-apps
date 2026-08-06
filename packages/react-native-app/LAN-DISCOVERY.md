# LAN discovery permissions

`ReactNativeLanDiscovery` intentionally receives a native zeroconf browser and
permission callback from the host app. This keeps the core package independent
of a particular React Native zeroconf library and makes denied permission a
truthful `LAN_PERMISSION_DENIED` failure.

- iOS: add `NSLocalNetworkUsageDescription` and Bonjour service types containing
  `_sovereign-apps._tcp` to `Info.plist`.
- Android: request the platform local-network/multicast permission required by
  the target SDK before starting the browser; release multicast locks on stop.

Records are untrusted candidate hints. The app must complete QR/auth pairing
before opening an application stream, and must keep manual QR pairing when LAN
permission or DNS-SD is unavailable.
