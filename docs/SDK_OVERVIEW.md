# Mini App SDK v1 Overview

## Authoring goal

An agent should be able to read the SDK documentation and return one JavaScript module that passes the host validator and executes inside Pocket Tools.

The current surface is intentionally limited to the working script-driven slices.

## Required script shape

Every script must:

1. Be one ES module.
2. Import only from `@pocket-tools/sdk`.
3. Default-export one `defineMiniApp(...)` result.
4. Declare `sdkVersion: 1`.
5. Provide a `home` screen.
6. Use serializable values across host boundaries.
7. Complete screens and actions synchronously.

## Settings

The current setting definitions are:

- `setting.select`
- `setting.money`
- `setting.number`

Conditional visibility uses a declarative equality rule. The host renders and persists these settings under the mini-app manifest ID.

Settings may represent durable tool inputs when retaining the last value is useful. Tip Splitter uses money and number settings for bill amount, tip percentage, and party size. Those inputs survive relaunch without adding calculator-specific host state.

## Collections

The current fields are:

- `field.number`
- `field.money`
- `field.datetime`

Collection clients currently provide insert, query, count, and sum. The only filter operator is `gte`, matching the first reference script's local-day totals. Raw SQL, indexes, schema migrations, and unused CRUD operations are unavailable.

Inserted records and all rendered values must contain only finite JSON-compatible values made from plain objects and arrays. Bigints, functions, symbols, class instances, cyclic structures, non-finite numbers, and unsafe prototype keys are rejected.

## Screens and UI

A screen receives `MiniAppContext` and returns one `ui.page(...)` tree synchronously.

Current nodes:

- Page and section
- Metric and timer
- Button
- Summary
- List, list item, and empty state

The native response boundary validates every node before React Native renders it. Validation includes:

- Exact property allowlists for each node type
- Required and bounded strings
- Lower camelCase timer and action identifiers
- Finite numeric values for money, duration, and number formats
- List child-type rules
- A maximum of 512 nodes
- A maximum tree depth of 16
- No nested page nodes

Unknown properties are rejected rather than ignored. Scripts cannot pass React Native style objects or arbitrary native component properties through the UI tree.

A metric may declare:

```js
liveTimer: {
  timerId: "currentTrip",
  ratePerHour: 25,
}
```

The host then updates the displayed value from the durable timer without re-running the script every second.

Money, number, duration, and date-time output are formatted by the host. The current MVP uses deterministic `en-US` formatting and USD for the money format; scripts do not construct locale-specific formatted currency for metric or summary values.

Returning a promise from a screen is not supported by the current SDK. Queued microtasks created during module evaluation are drained before the screen is invoked.

## Actions

Buttons name an action using a lower camelCase identifier. The host invokes the matching registered handler with a snapshot-backed context. Unknown actions fail through the runtime bridge rather than invoking arbitrary host functions.

An action may request current collection inserts and timer changes. The host applies the resulting operation list transactionally.

Actions must complete synchronously. Returning a promise produces an `ASYNC_NOT_SUPPORTED` runtime error.

## Timers

`context.timers` provides `start`, `get`, and `stop`. A timer is durable host state based on its UTC start timestamp. The script is not kept alive while it runs.

## Console output

Scripts may use:

- `console.log`
- `console.info`
- `console.warn`
- `console.error`

The host captures this output as bounded runtime log entries. When the configured entry or byte limit is reached, additional output is discarded and the response reports that logs were truncated.

Console output is diagnostic data only. It does not provide access to Android logging, React Native, Expo modules, or host state.

## Runtime failure behavior

The host reports machine-readable error codes for source, request, result, timeout, memory, stack, unsupported module, bridge, promise, validation, UI, and native-runtime failures.

A runtime failure may include a bounded script stack and captured logs. Every invocation uses a new QuickJS runtime, so a failed script cannot alter the next invocation's global state.

## Change policy

Pocket Tools supports one current SDK contract during development.

- Obsolete APIs are removed directly.
- No compatibility shims, deprecated aliases, fallbacks, or script migrations are added.
- Documentation, runtime behavior, examples, and tests change with the contract.
- New APIs require a concrete working mini-app need.
