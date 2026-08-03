# Security Model

## Security objective

A pasted mini-app script may compute values and use narrowly defined host services without gaining ambient authority over the phone, host application, other scripts, or user data.

Every script is untrusted, including scripts produced by an agent or written by the device owner.

## Trust boundaries

Trusted:

- Signed Pocket Tools host code
- The canonical SDK contract
- Host-owned native modules and services
- Installation UI

Untrusted:

- Pasted script source
- Script manifests and schemas
- Script-generated UI trees
- Script action return values

## Core invariants

1. Scripts execute in QuickJS-NG, not the React Native JavaScript runtime.
2. Each active mini app receives an isolated runtime and host namespace.
3. Only explicitly exposed SDK bridge methods are callable.
4. Every cross-boundary value must satisfy `SerializableValue` and host limits.
5. Native objects and host references never cross into the script runtime.
6. Preview mode cannot use installed data or durable side effects.
7. Installation writes occur only after validation succeeds.
8. Running timers do not imply running script code.
9. A runtime failure must not terminate or corrupt the host.

## Current host services

The first slice exposes only:

- Settings declared by the script
- Isolated collection storage
- Durable start/get/stop timers
- Host time
- Native rendering of the current UI nodes

There are no placeholder permission or capability APIs in the current SDK.

## Runtime limits

QuickJS execution, bridge payloads, source size, logging, and rendered UI trees must be bounded.

Exact values are not part of the SDK contract before an Android runtime exists to measure them. The runtime implementation must select explicit limits, test interruption and allocation failure on Android, and document the values alongside those tests.

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

Dates cross the boundary as ISO 8601 strings.

## Data isolation

Every operation is scoped by the host to the calling mini-app ID. Scripts cannot supply or override that namespace. Raw SQL is never exposed. Collection and field identifiers are validated against the installed definition.

Preview state uses a temporary namespace that is destroyed after preview.

## Source and module restrictions

Installed scripts may import only host-provided virtual SDK modules. The host rejects:

- Dynamic import
- Relative or absolute filesystem imports
- Package registry imports
- Remote URLs
- Native module references
- Host-provided code-evaluation bridges

The host does not provide network, filesystem, process, or React Native globals.

## Failure handling

Runtime interruption, allocation failure, invalid output, and bridge-validation failure become structured `PocketToolsError` values. Host logs must avoid recording complete user datasets.

A failed install does not modify installed source or data. A failed preview is discarded. A failed invocation may dispose and recreate only that mini app's runtime.

## Deferred work

File access, network access, secret storage, location, notifications, public script distribution, remote updates, and background jobs require separate concrete product requirements and threat modeling. They are not represented by placeholder SDK APIs.
