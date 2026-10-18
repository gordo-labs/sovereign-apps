# Optional MCP module for Sovereign Apps

This document defines a planned, opt-in MCP adapter for exposing an app's own
services to a user's local AI client. It is architecture and contributor scope,
not an implementation claim: no MCP server package is shipped today. The
module must remain independently selectable by generated apps and must not be
required for desktop/mobile pairing or ordinary app operation.

## Purpose and boundaries

The MCP server is an adapter at the application-service boundary. It translates
an allowlisted set of app capabilities into MCP tools/resources and delegates
each operation to the same app service and authorization policy used by the
normal UI. It does not own app data, identity keys, pairing, transport, or
authorization policy.

```text
User's local AI host (MCP client)
       │ stdio by default; optional authenticated loopback HTTP
       ▼
Desktop MCP adapter ── local auth/capability broker
       │                                    │
       └──────── app service API ────────────┘
                         │
             existing paired Iroh session (only if a capability
             needs a mobile-owned service)
                         │
                         ▼
                 Mobile app service
```

The mobile app is not an MCP listener in the initial design. The desktop is the
local MCP server host and calls the mobile only through the already authenticated
app-owned service channel. Mobile services must validate the delegated
capability again; the desktop MCP adapter cannot turn a local AI approval into
unrestricted mobile access.

| Concern | Authority / owner | MCP rule |
| --- | --- | --- |
| Desktop↔mobile pairing | Existing pairing protocol and the human | Pairing proves/authorizes that app peer relationship only; it does not authorize an AI client. |
| Local AI client approval | App's local hub/broker and the human | A distinct AI-client grant is required, scoped to named app capabilities. |
| MCP transport | MCP adapter | Authenticate the local client and bind its session to the approved grant. |
| App operation | App service/API on desktop or mobile | Enforce capability and app policy on every call, including downstream mobile calls. |
| Iroh transport/relay | Iroh endpoints and configured relay | Moves encrypted traffic; it is not an MCP auth server or app permission system. |

## Authorization model

Treat these as separate credentials and principals: the user's app identity,
the mobile pairing grant, and the local AI client's capability grant. Never
reuse a pairing QR as an MCP credential, present the mobile bearer grant to the
model, or expose Iroh private keys to the MCP process/client.

Recommended request path:

1. The user pairs desktop and mobile through QR/deep link and confirms the
   desktop identity as documented in [the pairing architecture](ARCHITECTURE.md).
2. The user explicitly enables the optional MCP module and approves a local AI
   client through the app's hub. Show the client identity and requested named
   capabilities; default to no access until approval.
3. The local broker issues a short-lived, revocable grant scoped to that client,
   app instance, capability set, and (where relevant) paired mobile peer. Keep
   refresh/long-lived secrets in OS-protected storage, not in model context,
   tool results, QR data, or ordinary logs.
4. The MCP adapter authenticates the connection and maps each tool call to a
   declared capability. The app service checks authorization and validates
   input independently. Mutating or externally consequential operations use
   explicit user confirmation unless the app owner has established a narrower
   policy.
5. For a mobile-owned operation, desktop sends the minimum authorized request
   through the existing paired Iroh service. Mobile validates the peer,
   capability, request schema and expiry before executing it.
6. Revoking the AI client, a capability, the app pairing, or the relevant
   mobile peer closes affected MCP sessions and invalidates downstream grants.
   Revocation must fail closed if the broker or app service is unavailable.

An app may choose different UX or grant lifetimes, but must preserve separate
principals, least privilege, per-call authorization, and revocation. Do not
silently inherit every permission of the logged-in desktop user.

## Transports and local security

- **Default: stdio.** A trusted local AI host launches the server process and
  passes a short-lived, capability-scoped credential through the process
  environment, as prescribed for stdio by the MCP authorization spec. The
  app's broker can mint it after explicit approval; keep any renewal secret in
  OS-protected storage, and never expose the process credential to model
  context, logs, or unrelated child processes. Do not add the MCP HTTP OAuth
  flow to stdio.
- **Optional: Streamable HTTP on loopback.** Only add when a real local client
  requires it. Bind to loopback, validate the `Origin` header to mitigate DNS
  rebinding, authenticate every connection, and reject remote interfaces by
  default. Follow the current MCP transport and authorization specifications;
  HTTP OAuth/protected-resource metadata is for HTTP deployments, not a
  substitute for app capability checks.
- **No public MCP endpoint in the starter.** Remote MCP access, reverse
  proxies, hosted OAuth, and direct mobile MCP listeners are separate future
  design work with a distinct threat model; they are not implied by local MCP.
- Negotiate and pin supported protocol versions. Validate all tool arguments
  and resource URIs, set payload/time limits, propagate cancellation, and
  implement bounded concurrency/backpressure.

The implementation should follow the official current [MCP authorization
specification](https://modelcontextprotocol.io/specification/draft/basic/authorization)
and [Streamable HTTP transport guidance](https://modelcontextprotocol.io/specification/draft/basic/transports/streamable-http),
rechecking both when implementation begins because the transport draft may
evolve. The authorization guidance explicitly distinguishes HTTP OAuth from
stdio credentials.

## Tool and data safety

- Start with a small, read-only allowlist. Publish only stable app operations,
  not internal database access or a generic RPC/shell/filesystem escape hatch.
- Give every tool a stable name, versioned input/output schema, capability ID,
  data classification, side-effect label and confirmation policy. Keep resource
  URIs app-scoped and reject arbitrary file/network targets.
- Treat model-generated arguments and content returned by tools as untrusted.
  A document, message or remote peer may contain prompt injection; it cannot
  grant itself more tool permissions or disable confirmation requirements.
- Do not log prompts, secrets, QR payloads, full tool payloads or private
  addresses by default. Audit actor/client ID, capability, outcome, time and
  confirmation decision with configurable retention and redaction.
- Bound responses and redact secrets/private fields before they reach the MCP
  client. Apply per-capability rate limits and timeouts; handle cancellation,
  client disconnect and app shutdown without leaving work running.
- Keep the module optional in `create-sovereign-app`. When omitted, generated
  apps must have no MCP dependencies, process startup, endpoint, permissions or
  auth code.

## Contributor task plan

Each `MCP-*` item is a focused PR. These tasks describe a post-core-V1 optional
module; they do not add a dependency to the V1 desktop/mobile pairing gate.

| ID | Atomic PR scope | Dependencies | Acceptance evidence |
| --- | --- | --- | --- |
| MCP-01 | Define the app capability registry and MCP service contract: tool/resource metadata, schema/version policy, side-effect and confirmation labels, and desktop/mobile service delegation. No server runtime. | — | Public docs and typed contracts agree; contract tests reject undeclared capability IDs, unknown schema versions, oversized/invalid arguments and unscoped resources. |
| MCP-02 | Add the desktop local authorization broker for separately approving an AI client and issuing scoped, short-lived grants. | MCP-01; V1-04 secure storage | Approval is explicit; grant cannot exceed approved capabilities; client/app/peer scope and expiry are checked; revoke/expiry invalidates grants and secrets remain in OS-protected storage. Negative tests prove pairing alone does not authorize MCP. |
| MCP-03 | Implement the optional stdio MCP server package and one small read-only reference tool set backed by app services. | MCP-01, MCP-02 | MCP initialize/list/call flow passes protocol tests; unknown tools and unauthorized calls fail closed; argument/response bounds, cancellation, redaction and server shutdown are tested; the model never receives private keys or pairing bearer grants. |
| MCP-04 | Add an opt-in Streamable HTTP loopback adapter only if a supported local client needs it. | MCP-01–MCP-03 | Server binds loopback by default, rejects non-loopback binding absent explicit configuration, validates Origin, authenticates each session, passes transport conformance tests, and has negative DNS-rebinding/unauthenticated-request tests. No public endpoint is enabled by default. |
| MCP-05 | Route a narrowly scoped MCP capability to a mobile-owned service through the paired Iroh channel. | MCP-01–MCP-03; V1-05 grant lifecycle | Mobile revalidates the delegated capability, peer, expiry and schema; tests cover allowed/denied calls, disconnect, stale grant, revoke and replay; the MCP client cannot address arbitrary peers or services. |
| MCP-06 | Integrate selectable MCP module into `create-sovereign-app` and publish security/operator docs. | MCP-03; MCP-04 if shipped; MCP-05 if mobile tools are exposed | Generated project with MCP builds and passes the reference flow; project without MCP has no dependency or endpoint; threat model, setup, tool permissions, revocation, logging and known limitations are reviewed and linked from README. |

Before accepting the first MCP release, run a security review covering local
process trust, malicious MCP clients, prompt-injection content, confused-deputy
paths, grant theft/replay, revocation races, loopback DNS rebinding, oversized
messages, log leakage, and mobile disconnect/reconnect behavior. Report the
tested client/runtime versions and retain only sanitized evidence.

### Copyable implementation prompts

Use one prompt per PR; retain the task ID and acceptance criteria above.

- **MCP-01:** "In Sovereign Apps, define and test the typed app capability
  registry and MCP-facing tool/resource metadata contract only. Do not add a
  server runtime. Enforce versioned schemas, side-effect/confirmation labels,
  app-scoped resource identifiers, and bounded validation; update docs and
  submit evidence for the MCP-01 acceptance criteria."
- **MCP-02:** "Implement the desktop-local broker for explicit AI-client
  approval and short-lived, revocable capability-scoped grants. Keep this
  principal separate from the user, paired phone and pairing bearer grant;
  use secure storage and fail closed on revoke/expiry. Add positive and
  negative tests proving pairing alone grants no MCP access."
- **MCP-03:** "Build the optional stdio MCP server package over the MCP-01
  contract and MCP-02 broker. Start with a minimal read-only allowlist, pass
  scoped stdio credentials only to the server process, validate and bound all
  tool I/O, support cancellation/shutdown, and prove denied calls cannot access
  undeclared app services. Do not add arbitrary shell, filesystem or RPC tools."
- **MCP-04:** "Only if a supported local AI client needs HTTP, add an opt-in
  Streamable HTTP adapter bound to loopback by default. Implement authenticated
  sessions, Host/Origin validation and DNS-rebinding defenses, reject unsafe
  binding by default, test protocol compatibility, and keep public exposure
  disabled. Follow the current MCP HTTP authorization and transport specs."
- **MCP-05:** "Expose one narrowly scoped mobile-owned app service through the
  existing paired Iroh channel for the MCP module. Revalidate client grant,
  paired peer, capability, expiry and input on mobile; add denial, revoke,
  replay, disconnect and reconnect tests. Do not make mobile an MCP listener or
  allow arbitrary peer/service addressing."
- **MCP-06:** "Integrate MCP as a selectable option in create-sovereign-app and
  publish its setup, permissions, revocation, threat model and limitations.
  Prove generated MCP-enabled output works and MCP-disabled output contains no
  MCP dependencies, process startup, endpoint or permissions; submit the
  security-review evidence required by MCP-06."

## Non-goals for the first module

- A hosted AI, cloud MCP gateway, public endpoint, or account federation.
- An MCP listener on the phone or replacing the current pairing/auth protocol.
- Giving the model direct database, shell, filesystem, network, keychain or Iroh
  key access.
- Treating MCP as the app's identity provider or as a replacement for app UI,
  app authorization, or human confirmation.
- Making MCP mandatory for all Sovereign Apps projects.
