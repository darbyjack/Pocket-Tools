# Pocket Tools Architecture

Pocket Tools is an Android-first Expo host for offline utilities authored as single JavaScript modules. The host owns native UI, persistence, lifecycle, installation, validation, failure containment, output, and Android services. A mini-app owns only its declarative definition and synchronous business logic.

Bathroom Pay, Tip Splitter, and the SDK 1.2 acceptance fixture are ordinary scripts, not privileged host features.

## End-to-end path

```text
source module
  → local or on-device inspection and validation
  → isolated preview namespace
  → retained-state render gate
  → installed active source
  → fresh bounded QuickJS-NG runtime
  → virtual @pocket-tools/sdk module
  → validated page, operations, effects, and notification intent
  → one host-owned SQLite transaction
  → native rerender and post-commit Android effects
```

Bundled examples are synchronized into a generated catalog only for one-time seeding. After insertion into `installed_mini_apps`, bundled and pasted tools use the same execution path.

## Repository layers

```text
apps/mobile/
  Expo Android host, editor, installed-tool library, renderer,
  protocol validation, lifecycle coordination, and SQLite adapters

modules/pocket-quickjs/
  QuickJS-NG native module, sandbox limits, executable SDK,
  runtime wrapper, and Android instrumentation

modules/pocket-notifications/
  Android notification scheduling, exact-access handling,
  reconciliation, recovery, and native validation

packages/sdk-contract/
  released TypeScript SDK contract and generated declarations

packages/authoring-tools/
  local validate, inspect, typecheck, declaration, and parity tooling

examples/
  ordinary compatibility reference mini-apps

docs/
  maintained authoring, contract, architecture, lifecycle,
  Android, backup, and release documentation
```

## Contract authority

Pocket Tools supports SDK 1.0, 1.1, and 1.2. SDK 1.2 is the current public contract.

A contract capability must agree across:

- TypeScript source and generated declarations
- composed local authoring runtime
- embedded QuickJS builders and clients
- inspection and runtime response models
- host protocol and version gates
- native UI validation and rendering
- SQLite validation and transactions
- output and notification services
- templates, fixtures, examples, and documentation

A lower-version manifest receives only the authority declared by that version. Internal implementation names do not create public API.

## Script format and module loading

A mini-app is one ES module that imports only `@pocket-tools/sdk` and default-exports one `defineMiniApp(...)` result.

The native module loader rejects relative or absolute files, external packages, Node modules, remote URLs, re-exports, and unsupported dynamic imports. Scripts do not execute in the React Native JavaScript runtime.

## Invocation lifecycle

Each inspection, screen render, or action:

1. validates source and request limits
2. creates a fresh QuickJS runtime and context
3. installs the executable virtual SDK and bounded console
4. compiles and evaluates the source
5. invokes one synchronous operation with a serializable host snapshot
6. validates definition use, queries, UI, operations, effects, and targets
7. serializes a bounded response
8. disposes the context and runtime

No writable script global survives an invocation. Host state is passed as function arguments. Durable timers and scheduled notifications do not keep JavaScript alive.

## Request and response model

React Native provides a validated snapshot containing current host time, declared setting values, collection records, timer state, desired notification state where required, the requested screen or action, and optional finite serializable input.

The runtime may return:

- inspection metadata
- one declarative page
- ordered durable operations
- bounded post-commit effects
- bounded console diagnostics

React Native independently validates the response envelope and exact shapes. The active inspection validates setting bindings, collection use, action and screen targets, notification routing, and manifest-version authority.

## Action transaction model

SDK 1.2 action clients update an in-runtime working snapshot and record explicit operations. Later reads and queries in the same action observe prior successful calls.

Before persistence, the host validates the complete action result and external preconditions that must fail atomically. It then applies setting, record, timer, and notification-registry operations in list order inside one SQLite transaction.

After commit, the host:

1. reconciles Android notification state
2. reloads committed tool state
3. rerenders the active screen
4. performs at most one output effect
5. displays at most one feedback effect

A validation or SQLite failure persists nothing and performs no effects. A post-commit Android failure cannot roll back durable data; desired notification state remains recoverable through reconciliation.

## UI, navigation, and timers

Scripts return serialized nodes. The host owns React Native components, layout, accessibility, setting controls, confirmation, destructive presentation, and event propagation.

Navigation is host-owned and may carry finite serializable input. The host preserves active screen and route input across rerenders.

Timers store UTC start timestamps under the installed namespace. React Native derives elapsed display after process death; QuickJS does not run continuously.

## Persistence and namespaces

`installed_mini_apps` stores immutable manifest ID, current metadata, active source, last-known-good source, and installation timestamps.

Settings, records, timers, and desired notifications are isolated by a trusted host-selected namespace. Ordinary installed execution uses the manifest ID. Preview and diagnostics use reserved disposable namespaces that scripts cannot select or observe.

Record IDs and timestamps are host-owned. Unknown fields and invalid values fail closed.

## Installation lifecycle

The editor validates source through the same executable SDK used on Android. Preview runs against a disposable clone of retained ordinary state. Notification requests remain preview-only.

The exact candidate must pass isolated first render and a final read-only render against retained installed state. Only then may install or update persist source. A successful update moves the previous active source to `last_known_good_source` atomically.

Rollback swaps the two validated sources without changing durable tool data. Duplicate starts from source only and requires a new manifest ID. Removal always deletes the installation and desired notifications; ordinary state may optionally be retained.

See [Installed Mini-App Lifecycle](INSTALLED_MINI_APPS.md).

## Failure containment

Independent limits cover source, request, result, heap, stack, execution time, logs, bridge complexity, UI node count, UI depth, operations, effects, queries, and notification schedules.

Malformed source, definitions, state, queries, operations, effects, notifications, UI, native responses, and unsupported asynchronous behavior become structured errors. A failed invocation cannot retain globals, partially commit an action, perform an effect, replace active source, or poison the next invocation.

See [Security Model](SECURITY_MODEL.md) for the complete trust boundary.
