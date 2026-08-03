# Mini App SDK v1 Overview

## Authoring goal

An agent should be able to read the SDK documentation and return one copy-and-paste JavaScript module that passes the same validator used by the phone application.

The contract lives in `packages/sdk-contract/src`. The current surface is intentionally limited to the first working Bathroom Pay slice.

## Required script shape

Every script must:

1. Be one ES module.
2. Import only from the virtual `@pocket-tools/sdk` module.
3. Default-export one `defineMiniApp(...)` result.
4. Declare `sdkVersion: 1`.
5. Provide a `home` screen.
6. Use only serializable values across host boundaries.

## Manifest

```js
manifest: {
  id: "bathroom-pay",
  name: "Bathroom Pay",
  description: "Track bathroom time and gross pay equivalent.",
  sdkVersion: 1,
}
```

IDs use lowercase kebab-case. Screen, action, setting, collection, and field keys use lower camelCase.

## Settings

The current setting definitions are:

- `setting.select`
- `setting.money`
- `setting.number`

Conditional visibility uses a declarative equality rule.

## Collections

The current field definitions are:

- `field.number`
- `field.money`
- `field.datetime`

Scripts receive collection clients for insert, query, count, and sum. Raw SQL, schema migrations, indexes, and unused CRUD operations are unavailable.

## Screens and UI

A screen receives `MiniAppContext` and returns one `ui.page(...)` tree.

The current UI surface contains only the nodes used by the first Bathroom Pay slice:

- Page and section
- Metric and timer
- Button
- Summary
- List, list item, and empty state

The host owns native rendering, accessibility, and formatting.

## Actions

Buttons name an action. The host invokes the matching handler with settings, isolated data, timers, and current host time.

## Timers

`context.timers` provides `start`, `get`, and `stop`. Timer records are host-owned and durable. The script is not kept alive while a timer runs.

## Embedded tests

Scripts may contain deterministic tests. The harness controls settings, time, actions, rendering, collections, and timers. Tests must not depend on wall-clock time or device-specific state.

## Change policy

The project supports one current SDK contract during development.

- Obsolete APIs are removed directly.
- No compatibility shims, deprecated aliases, fallbacks, or script migrations are added.
- Documentation, examples, and tests change with the contract.
- New APIs require a concrete working mini-app need.

## Current implementation status

This pull request defines and validates the minimal contract. QuickJS execution, Android rendering, and host persistence must be implemented together as the next working end-to-end slice before the contract expands.
