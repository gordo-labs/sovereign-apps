# Release candidate checklist

This checklist is intentionally executable as a dry run. It is not an
authorization to publish.

- [ ] The package has a completed support row and no `pending`/`unsupported`
      adapter is exported from its stable entrypoint.
- [ ] `pnpm install --frozen-lockfile`, build, typecheck, tests and lint pass
      under Node 22.12 and pnpm 9.15.9.
- [ ] `npm pack --dry-run --json` contains only `dist`, README, LICENSE and
      package metadata; no source, workspace paths, fixtures, maps containing
      host paths, secrets, `.env`, keys or product code.
- [ ] `pnpm release:pack` emits a SHA-256 manifest and SPDX/CycloneDX SBOM.
- [ ] Tarballs install anonymously in the applicable minimal Node, Next.js,
      Electron and React Native fixtures. Native bridge requirements are
      documented; the bridge itself is not bundled.
- [ ] `npm audit --omit=dev` and the dependency/license/secret scanners have
      no unreviewed findings.
- [ ] Changeset, changelog, compatibility matrix and deprecation/rollback note
      are present.
- [ ] GitHub Actions uses OIDC provenance and a protected release environment;
      stable publication still requires explicit operator approval.
