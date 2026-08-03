# Mini App SDK v1 Overview

## Authoring goal

An agent should be able to read the SDK documentation and return one JavaScript module that passes the host validator and executes inside Pocket Tools.

The current surface is intentionally limited to the working Bathroom Pay slice.

## Required script shape

Every script must:

1. Be one ES module.
2. Import only from `@pocket-tools/sdk`.
3. Default-export one `defineMiniApp(...)` result.
4. Declare `sdkVersion: 1`.
5. Provide a `home` screen.
6. Use serializable values across host boundaries.

## Settings

The current setting definitions are:

- `setting.select`
- `setting.money`
- `setting.number`

Conditional visibility uses a declarative equality rule. The host renders and persists these settings.

## Collections

The current fields are:

- `field.number`
- `field.money`
- `field.datetime`

Collection clients currently provide insert, query, count, and sum. The only filter operator is `gte`, matching Bathroom Pay's local-day totals. Raw SQL, indexes, schema migrations, and unused CRUD operations are unavailable.

## Screens and UI

A screen receives `MiniAppContext` and returns one `ui.page(...)` tree.

Current nodes:

- Page and section
- Metric and timer
- Button
- Summary
- List, list item, and empty state

A metric may declare:

```js
liveTimer: {
  timerId: "currentTrip",
  ratePerHour: 25,
}
```

The host then updates the displayed value from the durable timer without re-running the script every second.

## Actions

Buttons name an action. The host invokes the matching handler with a snapshot-backed context. The action may request current collection inserts and timer changes. The host applies the resulting operation list transactionally.

## Timers

`context.timers` provides `start`, `get`, and `stop`. A timer is durable host state based on its UTC start timestamp. The script is not kept alive while it runs.

## Change policy

Pocket Tools supports one current SDK contract during development.

- Obsolete APIs are removed directly.
- No compatibility shims, deprecated aliases, fallbacks, or script migrations are added.
- Documentation, runtime behavior, examples, and tests change with the contract.
- New APIs require a concrete working mini-app need.
