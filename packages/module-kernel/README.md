# `@sovereign-apps/module-kernel`

Neutral contracts for composing sovereign-app communication modules. The
kernel knows lifecycle, cancellation, capabilities and composition; adapters
own platform APIs and application code owns payload schemas.

Discovery and bootstrap only produce untrusted hints. A transport only moves
bytes. Trust is established by a pairing/auth module before an app codec is
allowed to exchange messages.
