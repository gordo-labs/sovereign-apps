# Iroh relay architecture and self-hosting

This document defines the relay's role in Sovereign Apps, the gap in the
current adapters, and the path for an adopter to operate a relay under their
own control. The template does **not** currently ship a relay server or a
complete end-to-end custom-relay configuration; those are V1 tasks below.

For exact server options, follow the version-pinned `iroh-relay` source and
release notes. Iroh's public self-hosting guide warns that the community guide
may lag server configuration changes. See the official [relay overview and
configuration guide](https://docs.iroh.computer/add-a-relay), [self-hosted relay
guide](https://docs.iroh.computer/iroh-services/relays/self-hosted), and the
[`iroh-relay` crate/server reference](https://docs.rs/iroh-relay/latest/iroh_relay/).

## What a relay does

An Iroh relay is a rendezvous and encrypted-packet forwarding service for Iroh
endpoints. It complements direct QUIC connectivity:

1. Each endpoint starts an Iroh endpoint and uses its configured relay map.
2. The desktop publishes a short-lived pairing address (here, in the QR or
   deep link). The address identifies the desktop endpoint and can carry direct
   address hints and its relay URL.
3. Mobile dials the endpoint. Iroh can attempt direct paths and use relays for
   connectivity assistance or packet forwarding when the selected network
   path needs it.
4. Pairing still authenticates the endpoint identity and issues the
   application grant. A relay URL, successful relay connection, or relay
   access token is never proof that the peer is authorized.

The relay is **not** the application server, identity provider, user directory,
pairing authority, push-notification service, persistent queue, database, or
web-presence service. It does not replace the QR-bound authentication flow.
It also does not make a peer reachable when the relay itself is unreachable or
the network blocks every supported route.

Iroh's relay protocol forwards packets encrypted between the two Iroh
endpoints; the relay operator does not receive the application plaintext or
the endpoint secret keys. The operator can still observe connection metadata
(such as endpoint identifiers, timing, volume and source network information)
and can delay, drop, rate-limit or deny traffic. Self-hosting therefore gives
control over availability, policy and metadata exposure; it does not remove
metadata or make the relay trusted for application authorization.

## Responsibilities and trust boundaries

| Component | Owns | Does not own |
| --- | --- | --- |
| Electron/mobile Iroh endpoint | Endpoint key, Iroh session, direct/relay path selection | The other endpoint's identity or application grant |
| Pairing protocol and host | User confirmation, one-use QR reference, peer-bound grant, app capabilities | Network reachability or relay uptime |
| Iroh relay process | Relay protocol, bounded forwarding, optional QUIC address discovery, operational limits/metrics | App payload semantics, account state, durable messages, app authorization |
| Address discovery | Resolving an endpoint identifier to usable addresses/relay hints | Establishing trust; returned addresses remain hints |
| Relay operator | DNS/TLS, deployment, updates, capacity, rate limits, monitoring, abuse response | Client-side encryption keys or application data access |

Treat every direct address, relay address, DNS record, ticket and QR as
untrusted routing input. Authenticate the peer over Iroh and validate the
application pairing transcript before delivering protected app messages.

## Relay versus discovery

Relay traffic and endpoint discovery are separate services:

- A relay moves traffic for a known endpoint address; it does not, by itself,
  tell an app which peer to connect to.
- DNS/Pkarr or another address-lookup service can publish the endpoint's relay
  URL and address hints. A deployment using QR/tickets can carry those hints
  directly and avoid a lookup for that pairing flow.
- Replacing the relay does **not** automatically replace Iroh's default
  discovery service. An adopter seeking no dependency on n0-operated services
  must configure both custom relay use and an address-lookup strategy that
  does not fall back to n0. For the template's initial QR flow, prefer carrying
  the desktop's endpoint ID, direct hints and custom relay URL in the
  short-lived pairing address.
- The relay map configured at endpoint startup and the relay URL carried in a
  peer address serve related but different purposes. A custom-only deployment
  must explicitly prevent accidental use of the default public relay map; a
  QR containing a custom URL alone is not evidence that no public relay was
  contacted.

## Deployment model for an adopter

An adopter can run the official open-source `iroh-relay` binary or container;
the template should consume the relay URL as configuration and should not bake
one company's relay into shared modules. A basic production setup is:

1. Allocate a server with a stable public IP and a DNS name, for example
   `relay.example.net`. Publish the required A/AAAA records and decide whether
   the relay is public, access-controlled, or limited to a deployment's
   endpoints.
2. Select and pin an `iroh-relay` release compatible with the exact Iroh client
   versions in the Electron native module and React Native bridge. Keep the
   server version, bridge commit and client versions in the deployment
   manifest; do not track a floating `latest` container tag in production.
3. Configure the official server with HTTPS and a managed certificate (the
   official example uses ACME). Persist certificate state, set an operations
   contact, and expose the health endpoint for monitoring.
4. Open only the required network paths. The standard relay HTTPS endpoint is
   normally on TCP 443. Iroh's QUIC address-discovery listener defaults to UDP
   7842 when enabled; whether it is enabled and reachable must match the pinned
   server/client config. HTTP 80 may be needed for the selected ACME challenge.
   Keep metrics private or disable them; do not expose an unauthenticated
   metrics listener to the public internet.
5. Apply the pinned access policy and resource limits. An open relay can be
   abused as public infrastructure; an allowlist, shared access token, or
   admission callback can reduce unwanted use where supported. Such a relay
   token is still not an app credential and must never be treated as the
   pairing grant.
6. Verify TLS and health (`/healthz` in the current upstream self-hosting
   example), then test two independently keyed endpoints. Verify both the
   configured relay path and the direct path where possible, and verify the
   relay-only case with direct reachability deliberately removed.
7. Configure **both** app hosts with an explicit custom relay profile and
   confirm that the QR/deep link advertises the intended relay URL. If the
   deployment claims to be independent of n0, block egress to public n0 relay
   and discovery services during the acceptance run and retain sanitized
   evidence of the selected path.

This is a deployment outline, not a ready-to-run compose file. The template's
V1 relay-kit task will add a version-pinned sample configuration, container
deployment, health checks and operator runbook only after its ports and options
are tested against the chosen `iroh-relay` version. Do not copy a config block
from an unpinned community guide into production without validating it against
the server release.

## Endpoint profiles

V1 should let an adopter choose a relay profile without changing pairing/auth
logic:

| Profile | Intended use | Rule |
| --- | --- | --- |
| `default` | Fast start and development | Uses the default Iroh relay configuration. Do not market it as fully self-hosted or as an availability commitment. |
| `custom` | Adopter-operated relay(s) | Requires one or more validated relay URLs. No silent fallback to the default public relay map. |
| `disabled` | LAN-only or controlled diagnostics | Relay use is explicitly off; surface that remote connectivity may fail. |

An eventual app config can be supplied by user/environment configuration rather
than hard-coded in source, for example:

```json
{
  "relay": {
    "mode": "custom",
    "urls": ["https://relay.eu.example.net/", "https://relay.us.example.net/"]
  }
}
```

This is a **target configuration shape**, not a claim that today's app hosts
already accept it. The Electron native library has a `relays` option, but the
Sovereign adapter currently only passes a relay mode. The pinned React Native
bridge currently starts with Iroh's default relay mode and has no startup
`RelayMap` option. The custom-relay tasks below must close both gaps and test
the actual native endpoints.

For reliability, Iroh supports configuring more than one relay; relays are
designed so capacity and regional redundancy can be provided by multiple
instances. A first self-hosted adopter can start with one relay, then add a
second region and prove failover before advertising high availability. A
multiple-relay list is not useful unless both clients receive the intended map
and the failover behavior is tested.

## Operations, availability and cost

- Relayed bytes consume the operator's network egress. Direct paths can reduce
  relay bandwidth, but a relay may remain useful for address discovery,
  liveness or fallback according to the client version and network conditions.
- The relay service is designed to be largely stateless with respect to
  application sessions; do not add app data or pairing grants to it. Persist
  server configuration and TLS material, monitor capacity, and scale/replace
  relay processes using the documented version's behavior.
- Use a relay near users to reduce added latency. Two regions improve
  availability only if the clients are configured with both and automatic
  failover has been observed. Document support by measured evidence, not by
  deployment count.
- Alert on health, capacity, rejected/rate-limited clients, egress and
  certificate renewal. Keep logs/metrics low in detail and set a retention
  window; endpoint IDs and connection timing are sensitive metadata.
- Pin and upgrade the relay server deliberately. Test an upgrade against both
  native clients before rollout; maintain a rollback path and rotate any
  access credentials that were exposed.

## V1 relay tasks

These tasks are part of the [V1 backlog](../README.md#v1-delivery-backlog) and
are independently reviewable PRs:

### V1-14 — Custom-relay API in the React Native bridge

Add a startup relay mode and relay-map/URL list to the public bridge API, pass
it to Iroh as `RelayMode::Custom`, validate URLs, and ensure `disabled` and
`custom` never silently become the default public relay set. Update the pinned
public bridge source in its own repository and add native-side and JS contract
tests. Keep the default behavior backward-compatible. Done when the exact API
is versioned and generated iOS/Android bindings compile.

### V1-15 — Relay profiles in the Sovereign host adapters

Expose the same typed `default`/`custom`/`disabled` profile to Electron and RN
hosts. Pass Electron's `relays` list to its native endpoint and pass the RN
profile through V1-14. Validate URL count/scheme/duplicates; make custom mode
require at least one URL; provide user/environment configuration without
committing secrets; propagate the desktop's chosen relay into its pairing
address. Done when tests assert the exact native config and a custom-only
profile cannot silently use the default public relays.

**Dependency:** V1-14.

### V1-16 — Version-pinned self-host relay kit

Add a minimal `deploy/iroh-relay` example containing the selected official
image/version, validated config, TLS/ACME setup, required port documentation,
health check, private metrics binding, resource-limit/access-control guidance,
upgrade/rollback notes and operator troubleshooting. Do not add credentials,
published endpoints or an app-specific relay dependency. Done when the sample
config is validated against that exact server version and the health check can
be exercised locally.

**Dependency:** none; can proceed in parallel with V1-14 and V1-15.

### V1-17 — Custom-relay end-to-end proof

Add a repeatable two-endpoint integration test using only the custom relay
profile. Cover relay-assisted connection, one-use pairing, bidirectional app
frames, relay-only connectivity, direct-path success, relay outage/failure
behavior and a negative proof that no default public relay or n0 discovery was
contacted in custom-only mode. Add a `custom-relay` physical evidence case to
the release runbook and run it on iOS and Android. The general first-pair
physical cases in V1-06/V1-07 do not satisfy this separate custom-relay proof.

**Dependencies:** V1-02, V1-03, V1-05, V1-14, V1-15 and V1-16.

### Optional after core V1 — Multi-region relay failover

Run two independently deployed relay instances and configure both in the
custom profile. Prove clients stay paired and recover if either region goes
offline; publish capacity/failover claims only with measured evidence. This is
an availability enhancement, not a prerequisite for a single-operator V1
relay.
