# Changesets

Add one Markdown changeset for every user-visible package change. Use
independent semver and state protocol compatibility. Changesets are consumed
by the release dry run; no changeset workflow is allowed to publish `latest`
without the protected release gate in `docs/RELEASE-POLICY.md`.
