# Security Policy

Sovereign Apps is pre-alpha and has no supported release. Do not use it to
protect production data or identities.

Please report vulnerabilities privately through GitHub's security advisory flow
for `gordo-labs/sovereign-apps`. Do not include secrets, private keys, personal
data, or live production endpoints in a public issue.

The known security gaps in the initial baseline are listed in
`docs/AUDIT-2026-08-06.md`; those known gaps do not need duplicate public reports.

## Release artifacts

Release candidates are dry-run only until the protected release environment is
approved. Do not attach private keys, pairing envelopes, bearer tokens, peer
IDs, `.env` files or unredacted logs to issues, pull requests, tarballs, SBOMs
or workflow artifacts. Report a suspected artifact leak privately through a
GitHub security advisory and rotate the affected credential.

The package-level release gates, anonymous fixture checks, provenance and
rollback procedure are documented in `docs/RELEASE-POLICY.md` and
`docs/RELEASE-CHECKLIST.md`.
