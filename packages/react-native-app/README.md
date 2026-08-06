# Sovereign React Native pairing example

`App.tsx` demonstrates the intended first-run flow: scan the desktop QR with
the device camera, verify the desktop fingerprint, and open the desktop
channel. The same parser accepts `sovereign://pair?...` and web links such as
`https://your-app.example/pair?...`; the text field is diagnostic-only.

Install the native camera module in the host app:

```sh
npm install react-native-camera-kit
cd ios && pod install
```

Add camera permission to the host (`NSCameraUsageDescription` on iOS and
`android.permission.CAMERA` on Android), then rebuild the native app. Expo Go
is not sufficient for this TurboModule; use a development client or a native
React Native build.

The node-to-node transport remains an optional composable module and is not
required by this pairing example.
