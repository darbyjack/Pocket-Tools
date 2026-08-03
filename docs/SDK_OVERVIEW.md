# Frozen Offline Mini App SDK v1

## Status

SDK v1 is the frozen public contract for the Pocket Tools Android MVP. The canonical TypeScript definitions live in `packages/sdk-contract`, and the embedded QuickJS module exposes the same builders and runtime clients.

This freeze applies to the MVP authoring surface. It does not promise compatibility with later post-MVP SDK versions. During pre-release development, obsolete APIs are removed directly rather than preserved through aliases, shims, or migrations.

## Authoring goal

An agent should be able to return one JavaScript ES module that imports only `@pocket-tools/sdk`, default-exports one `defineMiniApp(...)` result, and runs without React Native, Expo, Node.js, network, filesystem, or native access.

Every script must:

1. Be one ES module.
2. Import only from `@pocket-tools/sdk`.
3. Default-export one `defineMiniApp(...)` result.
4. Declare `sdkVersion: 1`.
5. Provide a synchronous `home` screen.
6. Use lower camelCase names for settings, collections, screens, actions, and timer IDs.
7. Use lowercase kebab-case for `manifest.id`.
8. Keep every bridge value finite and JSON-compatible.
9. Complete screens and actions synchronously.

## Manifest and definition

```js
export default defineMiniApp({
  manifest: {
    id: "example-tool",
    name: "Example Tool",
    description: "Optional description",
    icon: "optional-icon-name",
    sdkVersion: 1,
  },
  settings: {},
  collections: {},
  screens: {
    home() {
      return ui.page({ title: "Example Tool", children: [] });
    },
  },
  actions: {},
});
```

Unknown definition properties are rejected. A script cannot declare permissions or capabilities that SDK v1 does not expose.

## Settings

Settings are durable values isolated under the host-selected mini-app manifest ID. A definition may use:

- `setting.text`
- `setting.boolean`
- `setting.number`
- `setting.money`
- `setting.select`

All settings support `label`, optional `description`, `default`, and optional `visibleWhen` equality rules.

Text settings support `minLength` and `maxLength`. Number settings support `min`, `max`, and positive `step`. Money settings support `min` and `max`. Select options use unique string, number, or boolean values, and the default must exactly match one option.

Scripts read settings through:

```js
context.settings.get("settingName");
```

Scripts do not mutate settings directly. Settings-bound native UI controls request validated host updates, after which the active screen rerenders.

## Collections and fields

Collections are host-managed structured records. Supported fields are:

- `field.text`
- `field.boolean`
- `field.number`
- `field.money`
- `field.datetime`

Fields are required by default. Set `optional: true` to allow omission or `null`. Text and numeric fields support their corresponding bounds.

`id`, `createdAt`, and `updatedAt` are host-owned record properties. Scripts cannot declare or write those field names.

A collection client provides:

```js
const entries = context.data.collection("entries");

entries.insert(record);
entries.get(id);
entries.update(id, changes);
entries.remove(id);
entries.query(query);
entries.count(query);
entries.sum("numericField", query);
```

Writes requested by one action are applied by the host in one SQLite transaction. Records are isolated by manifest ID and collection name. Scripts never receive SQL or database handles.

### Queries

A query may contain:

```js
{
  where: [
    { field: "complete", operator: "eq", value: false },
    { field: "createdAt", operator: "gte", value: "2026-08-01T00:00:00.000Z" },
    { field: "createdAt", operator: "lte", value: "2026-08-31T23:59:59.999Z" },
  ],
  orderBy: [{ field: "createdAt", direction: "desc" }],
  offset: 0,
  limit: 50,
}
```

Supported operators are `eq`, `gte`, and `lte`. Boolean and `null` comparisons use equality only. `limit` and `offset` are integers from 0 through 10,000. `sum` accepts number or money fields only.

## Screens, actions, and navigation

Screens and actions are named synchronous functions. Every script must declare `home`.

```js
screens: {
  home(context) {
    return ui.page({
      title: "Home",
      children: [ui.navigation({ label: "Details", screen: "details" })],
    });
  },
  details() {
    return ui.page({
      title: "Details",
      children: [ui.navigation({ label: "Back", screen: "home" })],
    });
  },
},

actions: {
  save(context) {
    context.data.collection("entries").insert({ title: "Saved" });
  },
},
```

`ui.navigation` can target only a declared screen. `ui.button` can invoke only a declared action. The host owns the active screen and rerenders deterministically after navigation, setting updates, and actions.

Returning a promise from a screen or action produces `ASYNC_NOT_SUPPORTED`.

## Declarative native UI

Every screen returns one `ui.page(...)`. Supported frozen nodes are:

### Structure and copy

- `ui.page`
- `ui.section`
- `ui.row`
- `ui.column`
- `ui.heading`
- `ui.text`

### Display

- `ui.metric`
- `ui.timer`
- `ui.summary`
- `ui.list`
- `ui.listItem`
- `ui.emptyState`

### Input and interaction

- `ui.textInput`
- `ui.numberInput`
- `ui.toggle`
- `ui.select`
- `ui.button`
- `ui.navigation`

Input nodes bind by name to declared settings. `textInput` requires a text setting, `numberInput` requires a number or money setting, `toggle` requires a boolean setting, and `select` requires a select setting.

The host validates exact property allowlists, setting bindings, action targets, screen targets, value types, strings, formats, node count, and depth before React Native renders the tree. Arbitrary style objects and native component properties are rejected.

The current limits are 512 rendered nodes and 16 levels of depth. A page cannot be nested.

## Host formatting

Metric and summary values may use:

- `plain`
- `number`
- `money`
- `duration`

Number, money, duration, and date-time output are host-owned. The MVP uses deterministic `en-US` formatting and USD for `money`.

A metric may include:

```js
liveTimer: {
  timerId: "currentTrip",
  ratePerHour: 25,
}
```

React Native updates the displayed value from the durable timer without rerunning the script every second.

## Timers

The frozen timer surface is:

```js
context.timers.start("timerId");
context.timers.get("timerId");
context.timers.stop("timerId");
```

Timers are host-owned UTC timestamps isolated by manifest ID. A running timer does not keep QuickJS or the mobile process alive. The host reconstructs elapsed time after relaunch.

Pause, resume, cancel, metadata, notifications, and arbitrary background JavaScript are not part of SDK v1.

## Serializable values

Bridge values may contain only:

- `null`
- finite numbers
- strings
- booleans
- arrays of allowed values
- plain objects with safe string keys and allowed values

Bigints, functions, symbols, undefined values, class instances, native handles, cyclic objects, unsafe prototype keys, and non-finite numbers are rejected.

## Console and failures

Scripts may use `console.log`, `console.info`, `console.warn`, and `console.error`. Output is captured as bounded diagnostic records and does not grant access to Android logging or host services.

Failures use machine-readable codes for invalid definitions, settings, records, queries, operations, UI trees, actions, screens, timers, unsupported modules, invalid bridge values, source/request/result limits, runtime timeout, memory, stack, promises, and native failures.

Every inspection, render, and action uses a fresh QuickJS runtime. A failed invocation cannot retain globals or poison the next invocation.

## Security and deferred capabilities

SDK v1 is offline-only. It does not expose:

- Network requests
- Filesystem or document access
- Location
- Notifications
- Secrets or credentials
- React Native or Expo modules
- Custom native components
- Dynamic external imports
- Exact or arbitrary background JavaScript
- Schema migrations
- Compatibility aliases or deprecated APIs

Those capabilities require a separately approved post-MVP design and threat model.

## Freeze rule

After the SDK-freeze pull request merges, the contract above is the complete SDK v1 MVP surface. The TypeScript contract, executable QuickJS module, host validators, renderer, SQLite adapter, examples, and documentation must continue to change together. New public SDK surface requires an explicit post-MVP version decision rather than an unreviewed v1 addition.
