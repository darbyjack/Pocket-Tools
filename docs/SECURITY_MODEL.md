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
- Script console output

## Core invariants

1. Scripts execute in QuickJS-NG, not the React Native JavaScript runtime.
2. Every invocation receives a fresh runtime and context.
3. The module loader resolves only `@pocket-tools/sdk`.
4. Cross-boundary values are finite JSON-compatible values made from plain objects and arrays.
5. Native objects and host references never enter the script runtime.
6. Host state is passed to the runner as function arguments, not writable globals.
7. SQLite namespaces are selected by the host, not the script.
8. Requested writes are applied only after successful execution and host validation.
9. Running timers do not imply running script code.
10. Runtime, native-allocation, and response-decoding failures become structured errors rather than crossing JNI as exceptions.

## Current host services

The current script-driven slice exposes only:

- Declared setting values
- Isolated record insertion and current queries and aggregates
- Durable start/get/stop timers
- Current host time
- Native rendering of the current UI nodes

No capability or permission layer exists yet because this slice has no sensitive file, network, notification, location, or secret access.

## Runtime isolation

Each inspection, render, or action request creates a new QuickJS runtime and context. The runtime is disposed before the request returns.

The script cannot observe state left in `globalThis` by an earlier invocation. It does not receive React Native, Expo, Node.js, filesystem, SQLite, process-environment, or host-request globals.

The QuickJS module loader rejects external packages, relative paths, absolute paths, remote URLs, and dynamic imports that resolve outside the virtual SDK module.

## Runtime limits

The host currently supplies these defaults:

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

The native module validates every configuration again and refuses values outside hard safety ceilings. These values are implementation defaults, not SDK compatibility promises. They remain adjustable by trusted host code so Android benchmarking and focused tests do not require recompiling the native runtime.

The deadline uses QuickJS's interrupt handler and is also checked while draining pending promise jobs. Memory and stack bounds use QuickJS runtime controls. Source, request, result, and log bounds are enforced before values return to React Native.

## Promise and blocking behavior

QuickJS cannot block its worker through `Atomics.wait`. The host drains pending QuickJS jobs after module evaluation and after a screen or action call so queued microtasks complete deterministically.

Unhandled promise rejections become `UNHANDLED_PROMISE_REJECTION`. Screens and actions themselves remain synchronous in the current SDK; returning a promise produces `ASYNC_NOT_SUPPORTED`.

## Bridge validation

Allowed values are:

- `null`
- finite numbers
- strings
- booleans
- arrays containing allowed values
- plain objects with safe string keys and allowed values

Dates cross the boundary as ISO 8601 strings. `undefined`, native handles, functions, symbols, bigints, cyclic objects, class instances, unsafe prototype keys, non-finite numbers, and excessively deep or large object graphs are rejected.

The runtime validates inspection data, script-requested records, operation lists, and rendered UI before native JSON serialization. React Native validates the native response envelope, log records, success payload, and structured failure payload before using it.

## Console logging

The sandbox provides `console.log`, `console.info`, `console.warn`, and `console.error`. Messages are converted to strings inside QuickJS and returned as bounded log records with the runtime response.

When entry or byte limits are reached, additional output is discarded and `logsTruncated` is set. Console output never writes directly into host state or Android services.

## Data isolation

The host loads and writes state under the inspected manifest ID. Collection operations are checked against declared collections. Raw SQL is unavailable to scripts.

An action produces a serializable operation list. SQLite applies the list in one transaction; any failure rolls back the entire action.

## Failure handling

Failures use stable machine-readable codes, including distinct source, request, result, timeout, memory, stack, module, bridge, promise, and native-runtime failures. Messages and script stacks are bounded before crossing JNI.

The React Native host preserves the error code, script stack, captured logs, and log truncation state in `MiniAppRuntimeError`. A failed invocation does not poison the next runtime.

## Manual verification

No GitHub Actions workflow is enabled. After generating the Android project, run the repository checks and connected Android instrumentation tests manually:

```bash
pnpm install
pnpm check
pnpm sync:mini-apps
pnpm --dir apps/mobile exec expo prebuild --platform android --clean --no-install
cd apps/mobile/android
./gradlew :app:assembleDebug connectedDebugAndroidTest
```

The instrumentation suite covers infinite loops, allocation pressure, unsupported modules, ambient-global isolation, runtime-to-runtime isolation, malformed bridge values, promise jobs, unhandled rejections, log limits, result limits, and recovery after failure.

## Deferred work

File access, network access, secret storage, location, notifications, public script distribution, remote updates, and background jobs require concrete product requirements and separate threat modeling. They are not represented by placeholder APIs.
