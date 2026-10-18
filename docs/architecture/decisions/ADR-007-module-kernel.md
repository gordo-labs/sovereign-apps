# ADR-007: Neutral module kernel and composition

Status: accepted for SA-007 (2026-08-06)

The module kernel is the only owner of lifecycle, cancellation, composition and
module metadata. Identity/key storage, grant storage, discovery, bootstrap,
transport, pairing/auth, route policy, app codecs and diagnostics remain small
replaceable contracts. A discovery or bootstrap adapter can only return
untrusted material; a transport can only move framed bytes; trust and
capability authorization are explicit pairing/codec decisions.

`ModuleRegistry.validate` resolves IDs, dependencies, conflicts, platform
availability and required configuration before invoking `start`. Optional
modules may be unavailable or fail at startup without making the core
composition unavailable; the failure is retained in `optionalFailures` and
emitted as a secret-safe diagnostic. Required failures tear down already-started
modules in reverse order. Public consumers import the package root only.

Adapters must be idempotent for `start`/`stop`, honor `AbortSignal`, expose
typed cancellation/timeouts/errors, and close resources they own. The in-memory
adapter used by conformance tests is not a production transport and cannot
satisfy a platform readiness claim.
