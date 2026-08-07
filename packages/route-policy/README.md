# `@sovereign-apps/route-policy`

Local-first route selection for sovereign applications. It ranks and races
already-discovered candidates; it does not implement discovery, transports,
pairing, authentication or application protocols.

Every candidate carries its discovery source, bootstrap evidence, transport
adapter, address hints and trust binding. A caller must provide a trust
verifier. An authentication or trust failure is terminal for the operation and
never silently downgrades to an unverified route.

The policy is deterministic when supplied with an injected clock, randomness
source and network monitor. Metrics and decisions contain route identifiers and
safe classification fields only; addresses and bootstrap material are not
emitted.
