# Support matrix

Observed in SA-007. “Contract” means compile-time/API coverage; it is not a
claim that the platform adapter is implemented.

| Capability | Contract | Implemented adapter | Evidence |
| --- | --- | --- | --- |
| Identity and key storage | yes | no | `module-kernel/src/types.ts` |
| Secure grant storage | yes | no | `module-kernel/src/types.ts` |
| Discovery and bootstrap | yes | Electron DNS-SD advertiser; RN browser adapter | `electron-app/src/lan-discovery.ts`, `react-native-app/src/lan-discovery.ts` |
| Transport endpoint/session/framed stream | yes | no | `module-kernel/src/types.ts` |
| Pairing/auth/trust | yes | no | `module-kernel/src/types.ts` |
| Route policy and health | yes | no | `module-kernel/src/types.ts` |
| App codec/capabilities | yes | no | `module-kernel/src/types.ts` |
| Diagnostics | yes | no | `module-kernel/src/types.ts` |
| Composition validation | yes | registry | `module-kernel/test/kernel.test.ts` |
| Adapter conformance helpers | yes | in-memory tests only | `module-kernel/src/conformance.ts` |
| LAN mDNS/DNS-SD | target contract | desktop advertise + iOS/Android browse (permission injected) | `protocol/src/lan-discovery.ts` |
| QR / desktop Iroh / RN Iroh | target contracts | pending SA-003–SA-005 | backlog |

No row marked “implemented adapter” may be promoted to supported until a
platform-specific agent supplies runtime evidence.
