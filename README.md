# Sovereign Apps

Sovereign Apps is an open-source project for building applications whose
desktop and mobile versions can connect directly, without depending on a
product-specific cloud account or backend as their default control plane. Its
reference experience pairs an Electron desktop app with a React Native mobile
app: the desktop shows a QR code, the phone scans it, both sides confirm the
connection, and the apps gain an encrypted peer-to-peer communication channel.

The repository turns that connection pattern into reusable, application-neutral
modules. A project can start with the desktop/mobile pairing foundation and
choose which additional capabilities it needs. The examples are deliberately
small so adopters can understand the channel and build their own application
behavior on top.

## The larger idea

The project is exploring a more personal model for self-hosted apps: a desktop
client or home hub can be the service the user owns, while a phone connects to
it as a companion instead of relying on a vendor's account and cloud backend.
Authenticated QUIC connections can carry the app's own service traffic and
carefully scoped tunnels; an adopter-operated relay can help when the network
does not allow a direct route.

Over time, this could make self-hosting feel less like administering a server
and more like using personal software. A local AI running with the user's hub
could help interpret that app's data and services, then deliver only the
requested result or action to the paired mobile app. The AI would be an
optional, separately authorized layer—not a source of ambient access. This is
a product direction, not a capability this repository currently delivers:
the MCP adapter is only planned, and the present template is still a pre-alpha
pairing foundation.

## What is in this project

- Shared building blocks for pairing, communication, module composition and
  optional local discovery or presence.
- Minimal Electron and React Native example apps that demonstrate the intended
  desktop-to-mobile relationship.
- Optional examples for other bootstrap and communication approaches. They are
  separate from the basic QR pairing path.
- Public plans for the work needed to make the template ready for a stable
  release.

The project is **pre-alpha**. The pairing flow has automated contract tests,
but native builds and real-device pairing have not yet been verified across
the supported iOS and Android matrix. It should be read as a reusable project
in progress, not as a production-ready application or a promise that every
optional module is complete.

## Read the project in order

The [documentation guide](docs/README.md) is the step-by-step index. If you are
new to the repository, this is the recommended path:

1. [Understand the example](docs/getting-started/PAIRING-FLOW.md): what the
   desktop and phone do when they pair.
2. [See the project architecture](docs/architecture/ARCHITECTURE.md): how the
   reusable pieces fit together and where application-specific behavior goes.
3. [Explore the modules](docs/README.md#optional-modules): presence, offline
   bootstrap, relays and the planned local-AI/MCP adapter.
4. [Check the current limitations](STATUS.md) before relying on a capability.
5. [Browse the roadmap](docs/planning/ROADMAP.md) to understand the steps
   toward V1 and how to contribute a focused change.

## Project state

This is an MIT-licensed public repository. The goal is to help developers start
a sovereign or self-hosted app with a clear desktop/mobile connection
foundation, while keeping each optional module independently adoptable. Read
the [current status](STATUS.md) for verified capabilities and known gaps; the
documentation never treats planned modules as shipped features.

## Repository at a glance

- `apps/` contains runnable reference hosts and examples.
- `packages/` contains reusable modules intended for adopters.
- `docs/` contains the guided project documentation, technical references,
  operations notes and public roadmap.
- `vendor/` contains the public mobile Iroh bridge source pinned by the mobile
  example.

Start with the [documentation guide](docs/README.md), or see the
[contribution roadmap](docs/planning/ROADMAP.md) if you are ready to work on a
specific task.

## License

[MIT](LICENSE) © 2026 Gordo Labs.
