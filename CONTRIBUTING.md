# Contributing

Issues and pull requests are welcome. Start with the [documentation guide](docs/README.md),
then use the [V1 roadmap](docs/planning/ROADMAP.md) and
[architecture overview](docs/architecture/ARCHITECTURE.md) to find the right
scope. For a large protocol or module proposal, open an issue first so the
shape can be discussed before implementation.

The local `working/` notes folder is intentionally not part of the public
repository. Public decisions and contributor guidance must live in tracked
files.

## Pull requests

1. Choose one roadmap task ID where applicable; keep the PR focused and link
   any related issue.
2. Run the task's required validation. For general changes, use the pinned
   Node/pnpm versions and run `pnpm release:gates`.
3. Add tests for changed protocol or runtime behavior. Do not claim native or
   physical-device support based only on in-process tests.
4. Update `STATUS.md`, the relevant docs, and the support matrix when behavior
   or tested support changes.
5. Keep modules application-neutral; avoid product-specific names, payloads,
   secrets, peer identifiers, local paths, and generated artifacts.
6. Use conventional commit messages. Maintainer branches use the `gordo/`
   prefix; contributors may use any branch name in their fork.

## Contribution rights

You retain copyright in your contribution. By submitting a pull request, you
agree to make that contribution available under this repository's MIT license.
Only submit work you created or are authorized to contribute, including by
your employer if applicable. No separate CLA or DCO is currently required.
This is contribution guidance, not legal advice.

Security findings belong in a private GitHub security advisory, not a public
issue. See the [security policy](SECURITY.md).
