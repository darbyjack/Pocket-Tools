# Mini App SDK v1 Overview

## Authoring goal

An agent should be able to read the SDK documentation and return one copy-and-paste JavaScript module that passes the same validator used by the phone application.

The contract currently lives in `packages/sdk-contract/src`. Later phases will generate a distributable declaration file and machine-readable schema from it.

## Required script shape

Every script must:

1. Be one ES module.
2. Import only from the virtual `@pocket-tools/sdk` module.
3. Default-export one `defineMiniApp(...)` result.
4. Declare `sdkVersion: 1` and a positive script `version`.
5. Provide a `home` screen.
6. Request only capabilities it uses.
7. Use only serializable values across host boundaries.

## Manifest

```js
manifest: {
  id: "bathroom-pay",
  name: "Bathroom Pay",
  description: "Track bathroom time and gross pay equivalent.",
  sdkVersion: 1,
  version: 1,
  permissions: [
    {
      capability: "file-export",
      reason: "Export trip history as JSON or CSV files.",
    },
  ],
}
```

IDs use lowercase kebab-case. Object keys for screens, actions, settings, and collections use lower camelCase.

## Settings

Settings are declared metadata backed by host persistence. Supported v1 definitions are text, number, money, boolean, and select. Conditional visibility uses a declarative equality rule so the host can render settings without executing arbitrary UI code.

## Collections

Collections declare fields and optional indexes. Supported v1 field types are text, number, money, boolean, datetime, and JSON. Scripts receive collection clients for validated CRUD, queries, pagination, and numeric aggregates. Raw SQL is unavailable.

## Screens and UI

A screen is a function receiving `MiniAppContext` and returning one `ui.page(...)` tree. SDK v1 covers layouts, display values, timers, forms, inputs, buttons, links, lists, summaries, and basic tables.

The host validates tree depth, node count, properties, action names, payloads, and screen targets before rendering native components.

## Actions

Buttons and forms name an action. The host invokes the matching handler with a context and serializable payload. Actions request work through settings, data, timers, and approved capability clients.

Actions do not receive component references, navigation objects, databases, or native modules.

## Timers

`context.timers` provides `start`, `get`, `pause`, `resume`, `stop`, and `cancel`. Timer records are host-owned and durable. Scripts should store completed timer results in their own collections when the user ends an activity.

## Files

`context.files.exportText(...)` and `importText(...)` require the matching declared and granted capabilities. The host chooses the Android document flow and validates size and MIME constraints.

## Migrations

Migration keys are target script versions. A script at version 3 may define migrations `2` and `3`. The installer runs required migrations in order inside a transaction before activating the new source.

## Embedded tests

Scripts may contain deterministic tests. The harness controls settings, host time, actions, rendering, collections, timers, files, and permission outcomes. Tests must not depend on wall-clock time, the network, or device-specific state.

## Versioning rules

- Adding optional APIs may remain within SDK v1.
- Removing, renaming, or behaviorally breaking an API requires SDK v2.
- A host may support multiple SDK major versions.
- Script versions and SDK versions are independent.
- Deprecated APIs produce validation warnings before removal from a future SDK major.

## Current implementation status

Phase 0 defines the contract and validates definitions in the repository. QuickJS execution, Android rendering, persistence implementations, installer UI, and the deterministic embedded-test harness are delivered by later map tickets.
