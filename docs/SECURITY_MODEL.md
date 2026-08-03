# Security Model

## Security objective

A mini-app script may compute values and use narrowly defined host services without gaining ambient authority over the phone, host application, other scripts, or user data.

Every script is untrusted, including scripts produced by an agent or written by the device owner.

## Trust boundaries

Trusted:

- Signed Pocket Tools host code
- The current SDK contract
- The native QuickJS module
- Host-owned SQLite and React Native services

Untrusted:

- Mini-app source
- Script manifests and schemas
- Script-generated UI trees
- Script-requested operations

## Core invariants

1. Scripts execute in QuickJS-NG, not the React Native JavaScript runtime.
2. Every invocation receives a fresh runtime and context.
3. The module loader resolves only `@pocket-tools/sdk`.
4. Cross-boundary values are JSON-compatible finite values.
5. Native objects and host references never enter the script runtime.
6. SQLite namespaces are selected by the host, not the script.
7. Requested writes are applied only after successful execution and host validation.
8. Running timers do not imply running script code.
9. A runtime failure cannot terminate or corrupt the React Native host.

## Current host services

The Bathroom Pay slice exposes only:

- Declared setting values
- Isolated record insertion and current queries/aggregates
- Durable start/get/stop timers
- Current host time
- Native rendering of the current UI nodes

No capability or permission layer exists yet because this slice has no sensitive file, network, notification, location, or secret access.

## Runtime bounds

The Android native module currently enforces:

- 512 KiB maximum source
- 2 MiB maximum host request
- 32 MiB QuickJS heap
- 512 KiB QuickJS stack
- 250 ms execution deadline
- 512 UI nodes
- UI depth of 16

The deadline uses QuickJS's interrupt handler. Memory and stack bounds use QuickJS runtime controls. These values are implementation limits, not SDK promises, and must be checked on Android hardware before the draft pull request is made ready.

## Bridge validation

Allowed values are:

- `null`
- finite numbers
- strings
- booleans
- arrays containing allowed values
- plain objects with string keys and allowed values

Dates cross the boundary as ISO 8601 strings. Native handles, functions, symbols, bigints, cyclic objects, and class instances do not cross.

## Source restrictions

Installed-source support is not implemented yet, but the active runtime already rejects:

- Imports other than `@pocket-tools/sdk`
- Dynamic import resolution
- Relative or absolute filesystem imports
- Package registry modules
- Remote URLs
- React Native or Expo globals

There is no WebView or React Native `eval` fallback.

## Data isolation

The host loads and writes state under the inspected manifest ID. Collection operations are checked against declared collections. Raw SQL is unavailable to scripts.

An action produces a serializable operation list. SQLite applies the list in one transaction; any failure rolls back the entire action.

## Failure handling

Syntax, module, validation, timeout, memory, unknown action, unknown collection, timer, and UI failures are converted to runtime errors shown by the host. The runtime and context are always disposed after the request.

## Deferred work

File access, network access, secret storage, location, notifications, public script distribution, remote updates, and background jobs require concrete product requirements and separate threat modeling. They are not represented by placeholder APIs.
