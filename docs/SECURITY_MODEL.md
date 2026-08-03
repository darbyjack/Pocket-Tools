# Security Model

## Security objective

A pasted mini-app script must be able to compute values and request narrowly defined host operations without gaining ambient authority over the phone, host application, other scripts, or user data.

The host treats every script as untrusted, including scripts produced by an agent or written by the device owner.

## Trust boundaries

Trusted:

- Signed Pocket Tools host code
- The canonical SDK contract
- Host-owned native modules and services
- Host database migrations
- Permission and installation UI

Untrusted:

- Pasted or imported script source
- Script manifests and schemas
- Script-generated UI trees
- Script action payloads and return values
- Imported mini-app backups until validated

## Core invariants

1. Scripts execute in QuickJS-NG, not the React Native JavaScript runtime.
2. Each active mini app receives an isolated runtime and host namespace.
3. Only explicitly exposed SDK bridge methods are callable.
4. Every cross-boundary value must satisfy `SerializableValue` and size limits.
5. Native objects and host references never cross into the script runtime.
6. Capabilities are denied unless declared and granted.
7. Preview mode cannot use installed data or durable side effects.
8. Installation and migrations are transactional and retain the last working version.
9. Running timers do not imply running script code.
10. A runtime failure must not terminate or corrupt the host.

## Capability model

The manifest declares user-visible capabilities and a reason for each one. SDK v1 initially recognizes:

- `file-export`
- `file-import`
- `notifications`

Capabilities including network, location, secure values, device information, and arbitrary background work are reserved for later SDK versions. Declaring a known but unsupported capability fails validation rather than silently granting it.

Capability declarations do not grant access by themselves. The installer presents them to the user, and the permission broker supplies only approved host methods.

## Runtime limits

The contract defines initial defaults:

- 32 MiB normal runtime memory
- 64 MiB absolute runtime memory ceiling
- 512 KiB stack
- 250 ms CPU time per host invocation
- 512 KiB script source
- 1 MiB result payload
- 100 log entries per invocation
- UI depth of 32 nodes
- 1,000 UI nodes per render

These are conservative starting values. Device benchmarks may change them, but limit changes must remain explicit, tested, and documented.

## Bridge validation

Allowed values are:

- `null`
- finite numbers
- strings
- booleans
- arrays containing allowed values
- plain objects with string keys and allowed values

Rejected values include:

- `undefined`
- `NaN` and infinities
- functions
- symbols
- bigints
- cyclic objects
- class instances
- dates and native handles
- objects with custom prototypes

Dates cross the boundary as ISO 8601 strings. Money crosses as finite numeric amounts plus schema or formatting metadata.

## Data isolation

Every operation is scoped by the host to the calling mini-app ID. Scripts cannot supply or override the namespace. Raw SQL is never exposed. Collection and field identifiers are validated against the installed schema.

Preview data uses a temporary namespace that is destroyed after preview. Backup imports are validated before they can replace active state.

## Source and module restrictions

Installed scripts may import only host-provided virtual SDK modules. The host rejects:

- Dynamic import
- Relative or absolute filesystem imports
- Package registry imports
- Remote URLs
- Native module references
- `eval` or equivalent code-loading bridges supplied by the host

QuickJS language features remain available only within the bounded runtime. The host does not provide network, filesystem, process, or React Native globals.

## Failure handling

Runtime interruption, allocation failure, invalid output, migration failure, permission denial, and bridge-validation failure become structured `PocketToolsError` values. Host logs must avoid recording secrets or complete user datasets.

A failed script update leaves the previous source, grants, schema, and data active. A failed preview is disposable. A failed runtime invocation may dispose and recreate that mini app's runtime without affecting other apps.

## Threats deferred beyond SDK v1

Network access, secret storage, location, public script distribution, automatic remote updates, and exact background work require additional threat modeling before implementation. They are not partially enabled in the MVP.
