# Security Model

## Security objective

A mini-app script may compute values and use the frozen offline SDK without gaining ambient authority over the phone, host application, another script, or host-owned services.

Every script is untrusted, including scripts produced by an agent or written by the device owner.

## Trust boundaries

Trusted:

- Signed Pocket Tools host code
- The frozen SDK v1 TypeScript contract
- The matching embedded QuickJS SDK and runner
- Host-owned React Native and SQLite services

Untrusted:

- Mini-app source
- Script manifests and definitions
- Script-generated queries and UI trees
- Script-requested operations
- Script console output

## Core invariants

1. Scripts execute in QuickJS-NG, not the React Native JavaScript runtime.
2. Every inspection, render, and action receives a fresh runtime and context.
3. The module loader resolves only `@pocket-tools/sdk`.
4. Cross-boundary values are finite JSON-compatible values made from plain objects and arrays.
5. Native objects and host references never enter the script runtime.
6. Host state is passed as function arguments, not writable globals.
7. SQLite namespaces are selected from the inspected manifest ID by trusted host code.
8. Settings, records, queries, operation lists, action targets, screen targets, and UI trees are validated before use.
9. SQLite independently validates every persisted setting and record write.
10. One action's writes are applied in one transaction or not at all.
11. Running timers do not imply running script code.
12. Runtime, allocation, response-decoding, and validation failures become structured errors.

## Frozen host authority

SDK v1 exposes only:

- Declared isolated settings
- Declared isolated collection records
- Validated insert, get, update, remove, query, count, and sum behavior
- Durable start/get/stop timers
- Current host time
- Host-owned screen navigation
- Native rendering of the frozen declarative UI nodes

No capability or permission framework exists because SDK v1 has no file, network, notification, location, secret, or custom-native authority to grant.

## Runtime isolation

Each request creates a new QuickJS runtime and context and disposes them before returning.

Scripts cannot observe globals left by an earlier invocation. They do not receive React Native, Expo, Node.js, filesystem, SQLite, process environment, authentication, or host-request globals.

The module loader rejects external packages, relative and absolute paths, remote URLs, Node modules, and imports outside the virtual SDK module.

## Runtime limits

Current trusted-host defaults are:

- 512 KiB maximum script source
- 2 MiB maximum host request
- 2 MiB maximum serialized result
- 32 MiB QuickJS heap
- 512 KiB QuickJS stack
- 250 ms execution deadline
- 100 captured console entries
- 64 KiB captured console text
- 512 rendered UI nodes
- 16 levels of UI-tree depth

The native module validates configuration values against hard ceilings. These defaults are implementation limits, not future compatibility promises, and remain adjustable for Android benchmarking.

QuickJS's interrupt handler enforces the deadline during script execution and pending-job draining. Memory and stack limits use QuickJS runtime controls. Source, request, result, log, UI-node, and UI-depth bounds are enforced before output is used by React Native.

## Promise and blocking behavior

Blocking waits are disabled. The host drains pending jobs after module evaluation and after screen/action execution.

Unhandled promise rejections become `UNHANDLED_PROMISE_REJECTION`. Screens and actions are synchronous; returning a promise produces `ASYNC_NOT_SUPPORTED`.

## Bridge and response validation

Allowed bridge values are:

- `null`
- finite numbers
- strings
- booleans
- arrays containing allowed values
- plain objects with safe string keys and allowed values

Dates cross as strings. `undefined`, native handles, functions, symbols, bigints, cycles, class instances, unsafe prototype keys, non-finite numbers, and excessively complex object graphs are rejected.

QuickJS validates runtime inputs, collection/query use, requested operations, targets, and broad UI structure. React Native then validates the response envelope, logs, inspection definitions, exact operation shapes, exact UI properties, setting bindings, action targets, and navigation targets.

## Settings and data isolation

The host loads and writes state under the inspected manifest ID. A script cannot provide another namespace or construct SQL.

Settings are checked against their declared type, options, text bounds, and numeric bounds before persistence and again when loaded.

Collection fields are required unless explicitly optional. Unknown fields, host-owned `id`/`createdAt`/`updatedAt` properties, invalid types, non-finite values, invalid dates, and bound violations are rejected.

Query filters are typed. Text and boolean values support equality only. Number, money, and datetime fields support equality and ranges. Only optional fields may compare to `null`. Query fields, ordering, offset, limit, and sum targets are validated in QuickJS.

Insert, update, and remove operations cross the boundary explicitly. SQLite rechecks the declared collection, record ID, exact fields, required values, and merged update before mutating state. All operations from one action execute in one transaction.

## UI and interaction validation

Scripts never pass React Native components, style objects, event handlers, or native props.

The host accepts only the frozen node set and exact properties. Settings-bound controls must reference a declared compatible setting. Buttons must reference declared actions. Navigation nodes must reference declared screens. Invalid or oversized trees fail before rendering.

The host owns active-screen state and rerendering after navigation, settings changes, and actions.

## Timers

Timer IDs are lower camelCase names scoped by manifest ID. A timer stores a UTC start timestamp. The host reconstructs elapsed time after relaunch without keeping QuickJS or the React Native process alive.

SDK v1 does not expose pause, resume, arbitrary metadata, notifications, or background JavaScript.

## Console logging

The sandbox provides bounded `console.log`, `console.info`, `console.warn`, and `console.error`. Captured messages return as diagnostic records only and never write directly to Android services or persisted state.

## Failure handling

Failures use machine-readable codes for invalid source, definitions, settings, records, queries, operations, actions, screens, timers, UI, bridge values, unsupported modules, promises, runtime limits, native allocation, and malformed native responses.

`MiniAppRuntimeError` preserves the code, bounded script stack, captured logs, and truncation state. A failed invocation cannot retain global state, partially apply an action, or poison the next invocation.

## Manual verification

No GitHub Actions workflow is enabled. Run repository checks and Android instrumentation manually:

```bash
pnpm install
pnpm check
pnpm sync:mini-apps
pnpm --dir apps/mobile exec expo prebuild --platform android --clean --no-install
cd apps/mobile/android
./gradlew :app:assembleDebug connectedDebugAndroidTest
```

The Android suite covers sandbox containment, runtime recovery, frozen SDK builders, inspection metadata, multiple screens, native input nodes, typed filters, offset/limit behavior, and explicit insert/update/remove operations.

## Deferred capabilities

Network, files, secrets, location, notifications, public distribution, remote installation, cloud synchronization, custom native components, arbitrary background jobs, schema migrations, and compatibility shims require separately approved post-MVP designs. SDK v1 contains no placeholder authority for them.
