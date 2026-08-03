# Pocket Tools SDK v1 Agent Authoring Guide

This is the canonical starting point for an agent producing one Pocket Tools mini-app. Read this page before writing code. Use only the API documented here and in the linked frozen declarations.

## Required output

Return exactly one UTF-8 JavaScript ES module, normally named `<tool-id>.miniapp.js`.

The script must:

1. Import only from `@pocket-tools/sdk`.
2. Default-export one `defineMiniApp(...)` result.
3. Declare `sdkVersion: 1`.
4. Declare a synchronous `home` screen.
5. Use lowercase kebab-case for `manifest.id`.
6. Use lower camelCase for settings, collections, screens, actions, and timer IDs.
7. Use only finite JSON-compatible values across the SDK boundary.
8. Keep all mini-app business logic in the script. Never request host-specific code.
9. Avoid top-level await and asynchronous screens or actions.
10. Pass the local validation and inspection commands before delivery.

Do not mix explanations into the JavaScript file. Put implementation notes in a separate message.

## Canonical template

The block below is synchronized with [`docs/fixtures/agent-template.miniapp.js`](fixtures/agent-template.miniapp.js) and executed by repository tests.

<!-- BEGIN fixture: agent-template.miniapp.js -->

```js
// @ts-check

import { defineMiniApp, setting, ui } from "@pocket-tools/sdk";

export default defineMiniApp({
  manifest: {
    id: "replace-with-tool-id",
    name: "Replace With Tool Name",
    description: "Replace with one sentence describing the utility.",
    sdkVersion: 1,
  },

  settings: {
    message: setting.text({
      label: "Message",
      default: "Hello from Pocket Tools",
      maxLength: 200,
    }),
  },

  screens: {
    home(context) {
      return ui.page({
        title: "Replace With Tool Name",
        children: [
          ui.section({
            title: "Message",
            children: [
              ui.textInput({ setting: "message" }),
              ui.text({ text: String(context.settings.get("message")) }),
            ],
          }),
        ],
      });
    },
  },
});
```

<!-- END fixture: agent-template.miniapp.js -->

Replace the placeholder identity and remove every unused definition. Do not add empty settings, collections, screens, or actions merely for symmetry.

## Manifest

```js
manifest: {
  id: "daily-counter",
  name: "Daily Counter",
  description: "Track a small daily count.",
  icon: "optional-host-icon-name",
  sdkVersion: 1,
}
```

- `id` is the permanent storage identity and must use lowercase kebab-case.
- `name` is visible to the user.
- `description` and `icon` are optional.
- Only `sdkVersion: 1` is supported.

## Settings

Settings are durable, isolated by manifest ID, and changed only through settings-bound native controls.

Available definitions:

- `setting.text({ label, default, description?, minLength?, maxLength?, visibleWhen? })`
- `setting.boolean({ label, default, description?, visibleWhen? })`
- `setting.number({ label, default, description?, min?, max?, visibleWhen? })`
- `setting.money({ label, default, description?, min?, max?, visibleWhen? })`
- `setting.select({ label, default, description?, options, visibleWhen? })`

Read a setting with:

```js
const value = context.settings.get("settingName");
```

A visibility rule performs exact equality against another declared setting:

```js
visibleWhen: { setting: "mode", equals: "advanced" }
```

Select option values may be strings, finite numbers, or booleans. They must be unique, and the default must exactly equal one option value.

Scripts cannot set settings directly. Render the matching control:

- `ui.textInput` for `setting.text`
- `ui.numberInput` for `setting.number` or `setting.money`
- `ui.toggle` for `setting.boolean`
- `ui.select` for `setting.select`

## Collections and records

Declare structured local records with `collection` and `field`:

```js
collections: {
  entries: collection({
    title: field.text({ maxLength: 200 }),
    complete: field.boolean(),
    amount: field.money({ optional: true, min: 0 }),
    dueAt: field.datetime({ optional: true }),
  }),
}
```

Available fields:

- `field.text({ optional?, minLength?, maxLength? })`
- `field.boolean({ optional? })`
- `field.number({ optional?, min?, max? })`
- `field.money({ optional?, min?, max? })`
- `field.datetime({ optional? })`

Fields are required unless `optional: true`. Optional fields may be omitted or set to `null`.

The host owns `id`, `createdAt`, and `updatedAt`. Never declare or write those names.

Use a collection client inside a screen or action:

```js
const entries = context.data.collection("entries");

entries.insert({ title: "Example", complete: false, amount: null, dueAt: null });
const record = entries.get(recordId);
entries.update(recordId, { complete: true });
entries.remove(recordId);
const records = entries.query(query);
const count = entries.count(query);
const total = entries.sum("amount", query);
```

Writes should normally occur in actions. All operations requested by one action are applied transactionally by the host.

### Queries

```js
const records = entries.query({
  where: [
    { field: "complete", operator: "eq", value: false },
    { field: "createdAt", operator: "gte", value: "2026-08-01T00:00:00.000Z" },
    { field: "createdAt", operator: "lte", value: "2026-08-31T23:59:59.999Z" },
  ],
  orderBy: [{ field: "createdAt", direction: "desc" }],
  offset: 0,
  limit: 50,
});
```

Rules:

- Operators are `eq`, `gte`, and `lte`.
- Text and boolean fields support `eq` only.
- Number, money, and datetime fields support equality and ranges.
- Only optional fields may be compared with `null`, using `eq`.
- `orderBy.direction` is `asc` or `desc`.
- `limit` and `offset` are integers from 0 through 10,000.
- `sum` accepts number or money fields only.

## Screens, actions, and interaction input

Every screen is synchronous and returns one `ui.page`.

The optional second argument to a screen or action is `SerializableValue | undefined`. Narrow it before reading object properties:

```js
/** @param {import("@pocket-tools/sdk").SerializableValue | undefined} input */
function inputObject(input) {
  return input !== null && typeof input === "object" && !Array.isArray(input) ? input : {};
}
```

Use serializable input for record IDs and other small interaction data:

```js
screens: {
  home() {
    return ui.page({
      title: "Home",
      children: [
        ui.navigation({
          label: "Open details",
          screen: "details",
          input: { id: "record-id" },
        }),
      ],
    });
  },

  details(context, input) {
    const values = inputObject(input);
    const id = String(values.id ?? "");
    return ui.page({ title: "Details", children: [ui.text({ text: id })] });
  },
},
```

Actions are synchronous and request host operations:

```js
actions: {
  removeEntry(context, input) {
    const values = inputObject(input);
    const id = String(values.id ?? "");
    context.data.collection("entries").remove(id);
  },
},
```

Invoke the action with:

```js
ui.button({
  label: "Remove",
  action: "removeEntry",
  input: { id: record.id },
});
```

Do not use writable globals to pass screen or action state.

## Native UI nodes

Structure and copy:

- `ui.page({ title, children })`
- `ui.section({ title?, children })`
- `ui.row({ children })`
- `ui.column({ children })`
- `ui.heading({ text, level? })`
- `ui.text({ text })`

Display:

- `ui.metric({ label, value, format?, liveTimer? })`
- `ui.timer({ timerId, emptyValue? })`
- `ui.summary({ title, values })`
- `ui.list({ title?, items, emptyState? })`
- `ui.listItem({ title, subtitle?, trailing? })`
- `ui.emptyState({ title, description? })`

Input and interaction:

- `ui.textInput({ setting, label?, placeholder? })`
- `ui.numberInput({ setting, label? })`
- `ui.toggle({ setting, label? })`
- `ui.select({ setting, label? })`
- `ui.button({ label, action, input? })`
- `ui.navigation({ label, screen, input? })`

Supported display formats are `plain`, `number`, `money`, and `duration`. Money is host-formatted as USD in SDK v1. Datetime record values are ISO strings; SDK v1 has no `datetime` display-format token.

Arbitrary styles, colors, component names, event handlers, HTML, JSX, and React Native properties are unsupported.

## Timers

```js
context.timers.start("activeTimer");
const timer = context.timers.get("activeTimer");
const stopped = context.timers.stop("activeTimer");
```

Timers are durable host timestamps. A running timer survives process death without keeping JavaScript alive. SDK v1 has no pause, resume, notification, callback, or background-execution API.

A live money metric may use:

```js
ui.metric({
  label: "Current value",
  value: 0,
  format: "money",
  liveTimer: { timerId: "activeTimer", ratePerHour: 25 },
});
```

## Forbidden and nonexistent APIs

Do not import or use:

- Node.js modules such as `fs`, `path`, `process`, or `Buffer`
- React, React Native, Expo, JSX, HTML, DOM APIs, or WebView APIs
- `fetch`, XMLHttpRequest, WebSocket, or any network package
- Filesystem, document picker, clipboard, location, notifications, secrets, or credentials
- Dynamic imports, external packages, relative imports, or remote URLs
- `setTimeout`, `setInterval`, workers, or arbitrary background JavaScript
- SQLite, SQL, native handles, Android APIs, or custom native modules
- Invented builders such as `ui.form`, `ui.table`, `ui.dateInput`, `ui.modal`, or `ui.chart`
- Invented data methods such as `find`, `findOne`, `delete`, `upsert`, `transaction`, or raw SQL
- Migration declarations, deprecated aliases, compatibility layers, or permission manifests

Do not assume a common web or mobile API exists. When it is not listed in this guide or the frozen declarations, it does not exist in SDK v1.

## Validate and inspect locally

From the repository root:

```bash
corepack enable
pnpm install
pnpm validate:mini-app ./path/to/tool.miniapp.js
pnpm inspect:mini-app ./path/to/tool.miniapp.js
```

Machine-readable output:

```bash
pnpm mini-app validate ./path/to/tool.miniapp.js --json
pnpm mini-app inspect ./path/to/tool.miniapp.js --json
```

The commands execute the exact SDK and runner source embedded by the Android native module under QuickJS-NG WASM, then apply the canonical TypeScript definition validator. They do not launch Android.

A nonzero exit code means the script must not be delivered. JSON failures include a stable `error.code`; definition failures also include `issues` with exact `path` and `message` values. See [Authoring Error Codes](AUTHORING_ERRORS.md).

## Final agent checklist

Before returning a script, confirm all of the following:

- [ ] The output is one JavaScript ES module.
- [ ] It imports only from `@pocket-tools/sdk`.
- [ ] It default-exports one `defineMiniApp(...)` result.
- [ ] The manifest ID is lowercase kebab-case and `sdkVersion` is `1`.
- [ ] `home` exists and every screen/action is synchronous.
- [ ] Every referenced setting, collection, action, screen, and timer is declared or intentionally created.
- [ ] Every settings-bound input uses a compatible setting type.
- [ ] Required record fields are always supplied.
- [ ] Record IDs and timestamps are never declared or written by the script.
- [ ] Query operators and values match their field types.
- [ ] Interaction state is passed through serializable `input`, not globals.
- [ ] No unsupported import, host API, invented builder, or invented data method appears.
- [ ] No non-finite number, function, class instance, bigint, symbol, cycle, or native value crosses the boundary.
- [ ] The script passes `pnpm validate:mini-app`.
- [ ] `pnpm inspect:mini-app` reports the intended manifest, settings, collections, screens, and actions.

## Copy-and-paste agent prompt

Use [`AGENT_PROMPT.md`](AGENT_PROMPT.md) when delegating a script to an agent.

## Authoritative references

- [Frozen SDK v1 reference](SDK_OVERVIEW.md)
- [SDK v1 TypeScript declarations](../packages/sdk-contract/dist/index.d.ts)
- [Authoring error codes](AUTHORING_ERRORS.md)
- [Runtime and security boundary](SECURITY_MODEL.md)
- [Existing Bathroom Pay reference](../examples/bathroom-pay.miniapp.js)
- [Existing Tip Splitter reference](../examples/tip-splitter.miniapp.js)
