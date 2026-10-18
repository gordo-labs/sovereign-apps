# Release and support policy

The repository is a public pre-alpha template. The workspace root and the
Electron/React Native example shells are private-to-workspace template
projects; they are not npm libraries. A package is publishable only when its
row in [SUPPORT-MATRIX.md](./SUPPORT-MATRIX.md) has runtime evidence, tests,
documentation, and a release candidate accepted by the task owner.

## Package set and versioning

The first independently publishable set is:

| Package | Stable gate | Current state |
| --- | --- | --- |
| `@sovereign-apps/protocol` | SA-002 + SA-006 | pre-alpha |
| `@sovereign-apps/module-kernel` | SA-007 | pre-alpha |
| `@sovereign-apps/route-policy` | SA-009 | pre-alpha |
| `@sovereign-apps/web-presence` | SA-010 | pre-alpha |
| `@sovereign-apps/ble-bootstrap` | SA-012 | bootstrap-only, pre-alpha |
| `@sovereign-apps/offline-bootstrap` | SA-013 | optional, pre-alpha |

These packages use independent semver because consumers can opt into modules
without adopting the whole template. A breaking wire/protocol change requires
a major version of `protocol` and an explicit compatibility table. A package
that has not passed its support gate must remain unpublished or use a clearly
labelled prerelease (`0.x` or `-next`); no unsupported module may be promoted to
`latest`.

`@gordo-labs/react-native-iroh@0.2.0` is an independently owned native bridge.
It is a peer/runtime prerequisite for the React Native example and has its own
release and native-platform policy. This repository must not republish or
vendor it.

## Dry-run release sequence

1. Run the exact Node/pnpm versions in `.nvmrc` and `package.json`.
2. Run `pnpm install --frozen-lockfile`, build, typecheck, tests, and the
   release audit (`pnpm release:audit`).
3. Create a changeset describing each package and compatibility impact. The
   release PR must contain only the generated candidate artifacts and docs.
4. Run `pnpm release:pack`; inspect tarballs, hashes, SBOM and dependency/
   license/secret scans. Test anonymous fixture installs from the tarballs.
5. A maintainer reviews the provenance plan and explicitly approves a dry-run
   publish. Stable publishing requires a protected GitHub environment,
   trusted npm provenance, and an approved commit on `main`.

No command in CI may publish, tag, or promote `latest` automatically. If a
release is bad, deprecate the exact version, publish a patched version after
review, and document the rollback in the changelog; never delete a version
that consumers may already have installed.

## Provenance, SBOM and least privilege

The intended path is npm trusted publishing with GitHub Actions OIDC,
repository-scoped workflow permissions, a protected `release` environment,
two-person approval, and no long-lived npm token. Until trusted publishing is
configured, the operator must use a short-lived, least-privilege token locally
for a dry run only and record the missing configuration as a release blocker.

Every candidate records SHA-256 checksums, an SPDX or CycloneDX SBOM, npm
integrity, dependency/license results and the exact source commit. Upload these
as workflow artifacts and attach them to the release; do not put credentials,
private keys, pairing artifacts, `.env` files or peer IDs in artifacts.
