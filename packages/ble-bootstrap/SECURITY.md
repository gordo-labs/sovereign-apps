# BLE bootstrap security boundary

BLE discovery is an untrusted hint. A host MUST show the candidate and obtain
explicit user confirmation before transferring bootstrap material. The host
MUST then run the existing SA-005 authenticated transcript and MUST NOT grant
trust from a BLE name, address, RSSI, service UUID or successful reassembly.

The codec limits transfers to 8 KiB and 256 fragments, validates version,
sequence, lengths, transfer identity and SHA-256 integrity, and supports
timeouts/cancellation. These checks prevent malformed or stale transport data;
they do not authenticate a peer. Never put private keys, bearer tokens,
reusable grants or application payloads in advertisements/GATT values.

After pairing, hand candidates to route policy/Iroh. This package is a bootstrap
channel, not a BLE application-data or bulk-transfer transport. Native adapters
must report permission denied, Bluetooth off, background restriction,
disconnect and unsupported role as unavailable/failure states.
