# Pocket Tools Architecture

## Purpose

Pocket Tools is an Android-first host for small personal utilities authored as single JavaScript modules. The host owns native UI, persistence, permissions, lifecycle behavior, and failure containment. A mini app owns only its declarative definition and business logic.

The MVP is successful when an agent can produce one script from the published SDK documentation and that script can be pasted, validated, previewed, permission-reviewed, installed, and used without rebuilding the host.

## System boundaries

```text
React Native host
  ├─ mini-app library and editor
  ├─ installer and version manager
  ├─ native UI renderer
  ├─ SQLite-backed host services
  │    ├─ settings
  │    ├─ isolated collections
  │    ├─ durable timers
  │    └─ source/version history
  ├─ permission broker
  └─ QuickJS-NG runtime manager
       └─ one isolated runtime per active mini app
```

A mini app never receives a React Native component, native module, SQLite handle, filesystem path, process environment, authentication token, or another mini app's state.

## Script format

A mini app is one ES module. It imports the virtual `@pocket-tools/sdk` module and default-exports the result of `defineMiniApp(...)`.

```js
import { defineMiniApp, ui } from "@pocket-tools/sdk";

export default defineMiniApp({
  manifest: {
    id: "example-tool",
    name: "Example Tool",
    sdkVersion: 1,
    version: 1,
  },
  screens: {
    home() {
      return ui.page({ title: "Example Tool", children: [] });
    },
  },
});
```

The QuickJS module loader resolves only host-provided virtual modules. External package imports, dynamic imports, network-loaded code, and relative filesystem imports are rejected in installed scripts.

## Canonical contract

`packages/sdk-contract` is the source of truth for:

- Manifest and SDK versioning
- Capability declarations
- Settings and collection schemas
- Host service interfaces
- Declarative UI nodes
- Screen and action handlers
- Migrations and embedded tests
- Serializable bridge values
- Validation and structured errors
- Default safety limits

Host implementations, CLI validation, generated declarations, documentation examples, and fixture scripts must derive from or test against this contract.

## Execution lifecycle

1. The user pastes source into the editor.
2. The installer parses it as a JavaScript module and rejects unsupported imports.
3. The runtime evaluates it in installation mode with no durable capabilities.
4. The host validates the exported definition, schemas, permissions, migrations, tests, and SDK version.
5. The host displays requested capabilities.
6. The script is previewed against temporary settings and collections.
7. Embedded tests run against a deterministic harness.
8. Installation and migrations execute transactionally.
9. The previous active source and data version remain recoverable until activation succeeds.
10. At runtime, the host creates a bounded QuickJS context only when a screen or action needs script execution.

## Rendering model

Scripts return declarative UI trees. The host validates each tree and maps supported nodes to owned React Native components. This keeps styling, accessibility, navigation, form handling, formatting, and native behavior under host control.

Scripts cannot retain component references or mutate rendered nodes. A screen rerenders after an action or relevant host-state change.

## Persistence model

The host database contains separate namespaces for:

- Host metadata and source versions
- Per-mini-app settings
- Per-mini-app collection schemas and records
- Per-mini-app timers
- Permission grants
- Installation and migration state

Scripts use host-managed service calls. They never construct SQL. Preview databases are isolated from installed data.

## Timer model

Timers are durable host records based on timestamps and accumulated duration. A running timer does not keep the host process or QuickJS runtime alive. Visible timers update in React Native while the screen is active; authoritative elapsed time is recalculated by the host.

## Compatibility

- `sdkVersion` identifies the host contract required by the script.
- `manifest.version` identifies the script and data-schema version.
- Host patch releases cannot break an existing SDK major version.
- Breaking SDK changes require a new major version.
- Script migrations are keyed by target script version and run transactionally.
- SDK migration and script-data migration are separate concerns.

## Repository shape

```text
apps/mobile/                 Expo host application (later phase)
packages/sdk-contract/       canonical public contract
packages/runtime-core/       runtime orchestration (later phase)
packages/script-validator/   source and definition validation (later phase)
packages/ui-renderer/        native renderer (later phase)
packages/data-service/       settings and collections (later phase)
packages/timer-service/      durable timers (later phase)
packages/test-harness/       deterministic script tests (later phase)
examples/                    complete mini-app scripts
docs/                        architecture and SDK documentation
```
