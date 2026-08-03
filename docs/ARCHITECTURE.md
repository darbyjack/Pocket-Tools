# Pocket Tools Architecture

## Purpose

Pocket Tools is an Android-first host for personal utilities authored as single JavaScript modules. The host owns native UI, persistence, lifecycle behavior, and failure containment. A mini app owns its declarative definition and business logic.

The first product milestone is a working Android slice that can load and run Bathroom Pay through the public SDK. The SDK must not grow beyond that slice until it works end to end.

## Long-term boundaries

```text
React Native host
  ├─ mini-app library and editor
  ├─ installer
  ├─ native UI renderer
  ├─ SQLite-backed host services
  │    ├─ settings
  │    ├─ isolated collections
  │    └─ durable timers
  └─ QuickJS-NG runtime manager
       └─ isolated runtime per active mini app
```

A mini app never receives a React Native component, native module, SQLite handle, filesystem path, process environment, authentication token, or another mini app's state.

These boundaries are intended to remain stable. Temporary execution paths that bypass QuickJS or privileged built-in versions of Bathroom Pay are not acceptable because they would need to be replaced later.

## Script format

A mini app is one ES module. It imports the virtual `@pocket-tools/sdk` module and default-exports the result of `defineMiniApp(...)`.

```js
import { defineMiniApp, ui } from "@pocket-tools/sdk";

export default defineMiniApp({
  manifest: {
    id: "example-tool",
    name: "Example Tool",
    sdkVersion: 1,
  },
  screens: {
    home() {
      return ui.page({ title: "Example Tool", children: [] });
    },
  },
});
```

The QuickJS module loader resolves only host-provided virtual modules. External packages, dynamic imports, network-loaded code, and filesystem imports are rejected.

## Canonical contract

`packages/sdk-contract` is the source of truth for the currently implemented mini-app surface:

- Manifest and the current SDK identifier
- Bathroom Pay settings and collection primitives
- Start/get/stop timers
- The UI nodes used by the first Bathroom Pay slice
- Screens, actions, and deterministic embedded tests
- Serializable bridge values
- Definition validation and structured errors

An API is not added until a working mini app needs it.

## Execution lifecycle

1. The user pastes source into the editor.
2. The installer rejects unsupported imports.
3. QuickJS evaluates the script without ambient native access.
4. The host validates the exported definition and SDK identifier.
5. The script is previewed against temporary state.
6. Embedded tests run against a deterministic harness.
7. The host installs the validated source and initializes its current schema.
8. At runtime, the host creates a bounded QuickJS context only when a screen or action needs execution.

A failed install leaves existing installed state untouched. This is transactional integrity, not backward-compatibility support.

## Rendering model

Scripts return declarative UI trees. The host validates each tree and maps supported nodes to owned React Native components. Scripts cannot retain component references or mutate rendered nodes.

## Persistence model

The host scopes settings, collection records, and timers by mini-app ID. Scripts use host-managed service calls and never construct SQL. Preview state is isolated from installed state.

The project does not provide script schema migrations or compatibility layers. During pre-release development, obsolete schema paths are removed and development data may be reset.

## Timer model

Timers are durable host records based on timestamps. A running timer does not keep the host process or QuickJS runtime alive. Visible timers update in React Native while the screen is open; authoritative elapsed time is calculated by the host.

## Change policy

Pocket Tools supports one current SDK contract during development. Scripts targeting another SDK identifier are rejected. Breaking changes replace the obsolete API directly, with documentation, examples, and tests updated in the same pull request.

## Repository shape

```text
packages/sdk-contract/  current public contract and validator
examples/               complete scripts that exercise the contract
docs/                   current architecture and product requirements
apps/mobile/            Android host, added by the first end-to-end implementation slice
```

Additional packages are created only when real code needs a separate concern.
