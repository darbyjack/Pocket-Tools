# Pocket Tools Architecture

## Purpose

Pocket Tools is an Android-first host for personal utilities authored as single JavaScript modules. The host owns native UI, persistence, lifecycle behavior, and failure containment. A mini app owns its declarative definition and business logic.

The current product is one complete script-driven Android slice using Bathroom Pay as the reference script. New SDK surface must be justified by the next working product layer.

## Implemented boundaries

```text
Expo / React Native host
  ├─ bundled mini-app catalog and selection
  ├─ generic script lifecycle hook
  ├─ declarative native UI renderer
  ├─ generic settings renderer
  ├─ Expo SQLite host state
  │    ├─ per-mini-app settings
  │    ├─ isolated collection records
  │    └─ durable timers
  └─ local Expo native module
       └─ fresh bounded QuickJS-NG runtime per invocation
```

A mini app never receives a React Native component, native module, SQLite handle, filesystem path, process environment, authentication token, or another mini app's state.

The host contains no Bathroom Pay-specific execution, storage, rendering, or lifecycle code. Bathroom Pay is data: one script passed through the same path as any other mini app.

## Script format

A mini app is one ES module. It imports the virtual `@pocket-tools/sdk` module and default-exports the result of `defineMiniApp(...)`.

The QuickJS module loader resolves only that host-provided module. External packages, dynamic imports, remote code, and filesystem imports are rejected.

## Canonical contract

`packages/sdk-contract` is the source of truth for the implemented mini-app surface:

- Manifest and current SDK identifier
- Current generic setting and collection definitions
- Start/get/stop timers
- Current declarative UI nodes
- Screens and actions
- Serializable bridge values
- Definition validation and structured errors

The runtime module contains the matching executable SDK surface required inside QuickJS. Contract changes must update the TypeScript contract, runtime module, reference scripts, documentation, and tests together.

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

## Bundled scripts

During the first vertical slice, `examples/*.miniapp.js` files are synchronized into a generated JSON catalog bundled with the Expo application. The catalog is seed data only; it does not create app-specific host code.

The synchronizer discovers scripts by filename pattern. Adding another example script does not require changes to the host hook, renderer, storage service, or QuickJS module. Runtime script installation and editing will replace the bundled-only development flow in a later layer.

## Failure model

Each runtime invocation has independent memory, stack, source, input, UI, and execution-time bounds. Script failures return structured errors to React Native. The runtime is disposed after the request, so a failed script does not poison later requests or terminate the host process.

## Repository shape

```text
apps/mobile/                    Expo Android host and generic renderer
modules/pocket-quickjs/         Android QuickJS-NG Expo native module
packages/sdk-contract/          current public authoring contract
examples/                       reference mini-app scripts
scripts/                        generic bundled-script synchronization
docs/                           current architecture and requirements
```

Additional packages are created only when working code needs a separate concern.
