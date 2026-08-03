# Pocket Tools Architecture

## Purpose

Pocket Tools is an Android-first Expo host for personal utilities authored as single JavaScript modules. The host owns native UI, persistence, navigation, lifecycle recovery, validation, and failure containment. A mini app owns only its declarative definition and business logic.

Bathroom Pay and Tip Splitter are reference scripts, not host features. No additional example app is required to extend the platform.

## Implemented boundaries

```text
Expo / React Native host
  ├─ temporary bundled development catalog
  ├─ generic source lifecycle hook
  ├─ host-owned active-screen navigation and serializable route input
  ├─ strict response and UI validation
  ├─ declarative native renderer
  │    └─ settings-bound native controls
  ├─ Expo SQLite host state
  │    ├─ per-mini-app validated settings
  │    ├─ schema-validated isolated records
  │    └─ durable start/get/stop timers
  └─ local Expo native module
       ├─ bounded JNI adapter
       ├─ frozen executable @pocket-tools/sdk module
       └─ fresh QuickJS-NG runtime and context per invocation
```

A script never receives a React Native component, native module, SQLite handle, filesystem path, process environment, authentication token, or another mini app's state.

## Script and module format

A mini app is one ES module. It imports the virtual `@pocket-tools/sdk` module and default-exports the result of `defineMiniApp(...)`.

The QuickJS module loader resolves only that host-provided module. External packages, relative imports, dynamic remote code, Node modules, and filesystem imports are rejected.

## Frozen canonical contract

`packages/sdk-contract` is the public source of truth for SDK v1:

- Manifest and frozen SDK identifier
- Text, boolean, number, money, and select settings
- Text, boolean, number, money, and datetime collection fields
- Insert, get, update, remove, query, count, and sum
- Typed equality and range filters, sorting, offset, and limit
- Synchronous screens and actions
- Finite serializable screen and action input
- Host-owned screen navigation
- Declarative layout, copy, input, interaction, display, list, summary, and timer nodes
- Start/get/stop durable timers
- Serializable bridge values
- Definition and value validation

`PocketQuickJsSources.h` contains the matching executable builders and runtime client behavior available inside QuickJS. Contract changes must update the TypeScript contract, executable SDK, response model, host validators, renderer, SQLite adapter, reference scripts, documentation, and tests together.

After the SDK-freeze work merges, additions to the public surface require an explicit post-MVP version decision. They are not added opportunistically to v1.

## Runtime request model

React Native sends QuickJS a serializable snapshot containing:

- Current host time
- Current validated setting values
- Current collection records
- Active timer snapshots
- Requested inspection, screen, or action
- Optional finite serializable screen or action input

The native runner passes the exported definition and host snapshot to a runtime-owned function as arguments. Host state is never installed on writable globals.

QuickJS returns a page and/or explicit operations. React Native validates the native response shape. The active inspection then validates UI setting bindings, action targets, navigation targets, and interaction input. SQLite independently validates every setting and record value before applying operations transactionally.

## Runtime lifecycle

Each inspection, render, or action request:

1. Validates trusted host limits and input sizes.
2. Creates one QuickJS runtime and context.
3. Installs only the frozen virtual SDK module and bounded console.
4. Compiles and evaluates the mini-app source.
5. Drains queued promise jobs and rejects unhandled promise failures.
6. Invokes the requested synchronous screen or action with optional serializable input.
7. Validates bridge values, query inputs, UI targets, and operation output.
8. Serializes a bounded structured response.
9. Disposes the context and runtime before returning to React Native.

The execution state outlives QuickJS teardown so native callback pointers never refer to expired stack state.

## Rendering and navigation

Scripts return serialized UI trees. The host validates exact node properties, value types, settings bindings, action names, screen names, interaction input, node count, and depth before mapping nodes to owned React Native components.

Settings-bound controls request validated host writes; scripts never receive mutable controls or host references. The host rerenders the current screen after setting updates and actions. `ui.navigation` changes the host-owned active screen and may carry finite serializable route input. The host preserves that input across later rerenders.

A button may carry finite serializable action input. This lets a generated CRUD utility target a record by host-owned ID without relying on writable globals, a second mutable state system, or app-specific host behavior.

Timers and `liveTimer` metrics update from durable timestamps in React Native. The script is not re-executed every second.

## Persistence model

Expo SQLite stores settings, records, and active timers under the inspected manifest ID. Scripts cannot provide or override the namespace and never construct SQL.

Record IDs and `createdAt`/`updatedAt` metadata are host-owned. Collection writes are schema validated both in QuickJS and again before SQLite mutation. An action's operation list is applied in one transaction; any failure rolls back the complete action.

The pre-release project deliberately has no schema migrations, deprecated aliases, or compatibility paths. Development data may be reset when the current pre-release schema changes.

## Temporary bundled source path

`examples/*.miniapp.js` files are synchronized into a generated JSON catalog for development. This is seed data only and does not create app-specific host code.

The on-device installer phase will replace this bundled-only entry path with an installed-script library, paste editor, isolated preview, transactional install/update, rollback, export, and deletion. The runtime, renderer, and storage boundaries remain the same.

## Failure model

Each invocation has independent source, request, result, memory, stack, execution-time, log, UI-node, and UI-depth limits. Blocking waits are disabled and pending jobs are drained under the same deadline.

Malformed definitions, settings, records, queries, operations, interaction input, inspections, UI trees, native responses, and promise failures become structured errors. A failed invocation cannot retain globals, partially apply an action, or poison the next runtime.

## Repository shape

```text
apps/mobile/                    Expo Android host, validators, renderer, SQLite adapter
modules/pocket-quickjs/         Android QuickJS-NG sandbox and executable SDK
packages/sdk-contract/          frozen public SDK v1 TypeScript contract
examples/                       existing reference mini-app scripts
scripts/                        temporary bundled-source synchronization
docs/                           architecture, security, SDK, and build documentation
```

Additional packages are created only when a working product layer needs a separate concern.
