# Sovereign Apps documentation

This guide is the human reading path through the repository. Begin with the
project description in the root [README](../README.md), then use the stages
below to build a complete picture. Technical pages are grouped by purpose so
you can go deeper only when you need to.

## 1. Understand the product idea

Read [How desktop and mobile pair](./getting-started/PAIRING-FLOW.md). It walks
through the reference experience from scanning the desktop QR to having an
authenticated communication channel, and clarifies what the example does and
does not provide.

Then read [Project architecture](./architecture/ARCHITECTURE.md) for the system
map: identities, discovery, bootstrap, transport, pairing, application
services and optional modules.

## 2. See what exists today

- [Project status](../STATUS.md) — verified state, release blockers and
  limitations.
- [Publishing readiness](./operations/PUBLISHING-READINESS.md) — what can be
  claimed publicly today and what still prevents a stable release.
- [Support matrix](./operations/SUPPORT-MATRIX.md) — implemented, tested and
  unsupported capabilities, with evidence boundaries.

Read these before treating any planned feature or in-process test as proof of
native or real-device functionality.

## 3. Choose an integration path

- [Run the reference example](./getting-started/PAIRING-FLOW.md#try-the-reference-apps)
  — build requirements and host-specific setup.
- [Electron and React Native bridge](./architecture/BRIDGE-INTEGRATION.md) —
  current mobile bridge contract and implementation gaps.
- [Module choices](#optional-modules) — decide which optional capabilities
  belong in a generated app.

## 4. Go deeper by topic

### Architecture and security boundaries

- [System architecture](./architecture/ARCHITECTURE.md)
- [Iroh relay and self-hosting](./architecture/RELAY-OPERATIONS.md)
- [Local AI and MCP module plan](./architecture/MCP-INTEGRATION.md)
- [Architecture decisions](./architecture/decisions/ADR-002-protocol-boundaries.md)
- [Module kernel decision](./architecture/decisions/ADR-007-module-kernel.md)
- [Bluetooth transport decision](./architecture/decisions/ADR-015-bluetooth-transport.md)
- [Dependency decisions](./architecture/decisions/DEPENDENCY-DECISIONS.md)

### Optional modules

- [Web presence](../packages/web-presence/README.md) — signed, short-lived
  presence for apps that choose to add a web-hosted component.
- [Offline bootstrap](./modules/OFFLINE-BOOTSTRAP.md) — handoff options such
  as deep links, files and NFC.
- [BLE feasibility](./modules/BLE-FEASIBILITY.md) — scope and limits of the
  current Bluetooth Low Energy bootstrap work.
- [Bluetooth payload matrix](./modules/bluetooth-transport-matrix.json) —
  measured/verified transport limits; currently no Bluetooth data transport.
- [MCP integration plan](./architecture/MCP-INTEGRATION.md) — optional local
  AI access to app-owned capabilities; planned, not shipped.

### Operating and releasing

- [Native release operations](./operations/NATIVE-RELEASE-OPERATIONS.md)
- [Release checklist](./operations/RELEASE-CHECKLIST.md)
- [Release policy](./operations/RELEASE-POLICY.md)
- [Sanitized support evidence](./operations/support-evidence.json)

### Contributing and project history

- [V1 roadmap and atomic PR tasks](./planning/ROADMAP.md)
- [Historical baseline audit](./history/AUDIT-2026-08-06.md)
- [Documentation map](../DOCS-MAP.md) — compact route for returning
  contributors and tools.

## Optional modules

Sovereign Apps is intended to be composable. The core reference path is
desktop/mobile pairing; additional capabilities should remain opt-in and must
not make that basic connection depend on a hosted service. Current module
examples or plans include:

| Module area | Purpose | State |
| --- | --- | --- |
| Web presence | Publish signed, short-lived presence/signaling records through an adopter's web app. | Framework-neutral package and Next.js example exist; not a marketing landing. |
| Iroh relay | Improve reachability when a direct path is unavailable; adopters can operate their own relay. | Server operations are documented; complete custom-only profiles remain planned V1 work. |
| BLE / offline bootstrap | Exchange bounded connection setup data nearby or out of band. | Partial/optional; platform adapters and device verification remain incomplete. |
| Bluetooth data transport | Carry application data over Bluetooth. | Not supported; zero verified payload limit. |
| Local AI / MCP | Let a separately approved local AI client call selected app capabilities. | Planned post-V1 module; no MCP server is shipped. |
| Node-to-node | Let two generic nodes communicate without desktop/mobile roles. | Composable example direction; not a prerequisite for the reference pairing flow. |

## Try the reference apps

The [pairing walkthrough](./getting-started/PAIRING-FLOW.md#try-the-reference-apps)
contains the setup commands and links to the [Electron host package](../packages/electron-app/)
and [mobile host guide](../apps/mobile/README.md). Check the current
[project status](../STATUS.md) before attempting native builds: generated
bridge artifacts and physical-device validation are still outstanding.

## Documentation ownership

- `getting-started/` explains the user's journey and how to try the examples.
- `architecture/` describes system boundaries, integrations and decisions.
- `modules/` covers optional bootstrap/communication modules.
- `operations/` contains publishing, platform support and release procedures.
- `planning/` contains future work and atomic contributor tasks.
- `history/` preserves dated audits that are no longer the current source of
  truth.
