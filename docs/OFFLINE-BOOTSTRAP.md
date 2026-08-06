# Offline bootstrap adapters

`@sovereign-apps/offline-bootstrap` is an optional handoff layer for the
single SA-005 pairing envelope. Deep links, file/share and NDEF carry only the
bounded serialized envelope; they do not create identity, authenticate a peer,
discover a route or transport application data.

## Support boundary

- Deep links are allowlisted by scheme, host and path. The parser rejects
  credentials, ports, fragments, unexpected query parameters and malformed
  base64url data. Applications must not log or copy raw artifact bytes.
- File/share requires the `.sovereign-pairing` extension and
  `application/vnd.sovereign-apps.pairing+json`, enforces the 2048-byte limit,
  validates a regular file and reads through one open handle. The artifact is
  sensitive and must be confirmed before it is consumed.
- NFC is an injected host contract for iOS/Android NDEF only. No desktop NFC
  support is claimed. Hosts report unavailable/permission/platform states and
  must provide device evidence before marking a combination supported.

Every import validates expiry, and a `BootstrapReplayStore` rejects reuse of a
session reference. User cancellation leaves the artifact unconsumed. After
confirmation the host must execute the existing signed SA-005 transcript and
SA-016 route selection; possession of a link, file or tag is never trust.
