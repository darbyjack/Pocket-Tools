# Pocket Tools Architecture

## Purpose

Pocket Tools is an Android-first host for personal utilities authored as single JavaScript modules. The host owns native UI, persistence, lifecycle behavior, and failure containment. A mini app owns its declarative definition and business logic.

The current product is one complete Bathroom Pay Android slice. New SDK surface must be justified by the next working product layer.

## Implemented boundaries

```text
Expo / React Native host
  ├─ Bathroom Pay settings UI
  ├─ declarative native UI renderer
  ├─ Expo SQLite host state
  │    ├─ per-mini-app settings
  │    ├─ isolated collection records
  │    └─ durable timers
  └─ local Expo native module
       └─ fresh bounded QuickJS-NG runtime per invocation
```

A mini app never receives a React Native component, native module, SQLite handle, filesystem path, process environment, authentication token, or another mini app's state.

## Script format

A mini app is one ES module. It imports the virtual `@pocket-tools/sdk` module and default-exports the result of `defineMiniApp(...)`.

The QuickJS module loader resolves only that host-provided module. External packages, dynamic imports, remote code, and filesystem imports are rejected.

## Canonical contract

`packages/sdk-contract` is the source of truth for the implemented mini-app surface:

- Manifest and current SDK identifier
- Bathroom Pay setting and collection definitions
- Start/get/stop timers
- Current declarative UI nodes
- Screens and actions
- Serializable bridge values
- Definition validation and structured errors

The runtime module contains the matching executable SDK surface required inside QuickJS. Contract changes must update the TypeScript contract, runtime module, example, documentation, and tests together.

## Runtime request model

React Native does not expose native functions directly to an untrusted runtime. It sends QuickJS a serializable snapshot containing:

- Current host time
- Current settings
- Collection records
- Active timer snapshots
- Requested mode, screen, or action

QuickJS returns a validated page and/or a list of requested operations. The host validates and applies writes transactionally.

## Rendering model

Scripts return declarative UI trees. The host validates node types and tree limits before mapping them to owned React Native components.

Timers and `liveTimer` metrics update in React Native from durable timestamps. The script is not re-executed every second.

## Persistence model

Expo SQLite stores settings, records, and active timers under the calling mini-app ID. Scripts cannot provide or override this namespace and never construct SQL.

The pre-release project does not provide schema migrations or compatibility paths. Obsolete development schemas are removed directly and development app data may be reset.

## Failure model

Each runtime invocation has independent memory, stack, source, input, UI, and execution-time bounds. Script failures return structured errors to React Native. The runtime is disposed after the request, so a failed script does not poison later requests or terminate the host process.

## Repository shape

```text
apps/mobile/                    Expo Android host and current renderer
modules/pocket-quickjs/         Android QuickJS-NG Expo native module
packages/sdk-contract/          current public authoring contract
examples/                       canonical mini-app scripts
scripts/                        source synchronization checks
docs/                           current architecture and requirements
```

Additional packages are created only when working code needs a separate concern.
