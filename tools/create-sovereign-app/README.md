# create-sovereign-app

The generator creates a reproducible, neutral starter from a versioned
`sovereign-app.json` manifest. It is deliberately standalone so an adopter can
run its tests without access to this monorepo or sibling application sources.

```sh
node src/cli.mjs --name my-app --platforms electron,android \
  --modules electron,reactNative,qr --dir ./my-app
node src/cli.mjs --name web-app --platforms web \
  --modules webPresence,nextExample --dir ./web-app --dry-run
```

Every generated project contains only selected module descriptors, a manifest
check, explicit generated/adopter-owned boundaries, and attribution notices.
The descriptors are integration points: they do not copy product code or
silently grant identity, authentication, authorization, or reachability.

The command refuses unsafe names, traversal paths, unsupported platform/module
combinations, missing dependencies, and accidental writes into a non-generated
directory. Re-running against a generated directory updates generated files
deterministically while leaving adopter-owned files untouched.

Bluetooth is intentionally not a selectable data-transport module. SA-015 keeps
BLE bootstrap-only until a native adapter and physical evidence matrix satisfy
`docs/ADR-015-bluetooth-transport.md`.

This tool is MIT licensed and is not published by SA-009.
