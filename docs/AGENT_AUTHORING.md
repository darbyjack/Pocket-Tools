# Pocket Tools SDK 1.1 Agent Authoring Guide

This is the canonical starting point for an agent producing one Pocket Tools mini-app. Use only the API documented here and in the committed TypeScript declarations.

## Required output

Return exactly one UTF-8 JavaScript ES module, normally named `<tool-id>.miniapp.js`.

The script must:

1. Import only from `@pocket-tools/sdk`.
2. Default-export one `defineMiniApp(...)` result.
3. Declare `sdkVersion: "1.1"` for new scripts.
4. Declare a synchronous `home` screen.
5. Use lowercase kebab-case for `manifest.id`.
6. Use lower camelCase for settings, collections, screens, actions, and timer IDs.
7. Use only finite JSON-compatible values across the SDK boundary.
8. Keep all business logic in the script. Never request host-specific code.
9. Avoid top-level await and asynchronous screens or actions.
10. Pass the local validation and inspection commands before delivery.

SDK 1.1 hosts continue to run SDK 1.0 scripts. Legacy numeric `sdkVersion: 1` is read as SDK 1.0 for already-installed scripts, but new source should use the explicit string version.

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
    sdkVersion: "1.1",
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

Replace the placeholder identity and remove unused definitions.

## Manifest versions

```js
manifest: {
  id: "daily-counter",
  name: "Daily Counter",
  description: "Track a small daily count.",
  sdkVersion: "1.1",
}
```

- `"1.0"` supports the original frozen offline SDK surface.
- `"1.1"` adds action presentation, actionable list items, disabled controls, destructive intent, and host-owned confirmation.
- A script must declare the lowest version whose features it uses.
- Unsupported versions are rejected before installation.

## Settings

Available definitions:

- `setting.text({ label, default, description?, minLength?, maxLength?, visibleWhen? })`
- `setting.boolean({ label, default, description?, visibleWhen? })`
- `setting.number({ label, default, description?, min?, max?, visibleWhen? })`
- `setting.money({ label, default, description?, min?, max?, visibleWhen? })`
- `setting.select({ label, default, description?, options, visibleWhen? })`

Read a setting with `context.settings.get("settingName")`. Scripts cannot set settings directly; render the matching `ui.textInput`, `ui.numberInput`, `ui.toggle`, or `ui.select` control.

## Collections and records

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

Available fields are `text`, `boolean`, `number`, `money`, and `datetime`. Fields are required unless `optional: true`.

The host owns `id`, `createdAt`, and `updatedAt`. Use the collection client inside screens and actions:

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

Writes requested by one action are applied transactionally by the host.

Queries support `eq`, `gte`, and `lte`, ascending or descending ordering, and integer `limit`/`offset` values from 0 through 10,000. Text and boolean fields support `eq` only. `sum` accepts number or money fields only.

## Screens, actions, and interaction input

Screens and actions are synchronous. Their optional second argument is `SerializableValue | undefined`. Narrow it before use.

```js
actions: {
  removeEntry(context, input) {
    if (typeof input !== "string") throw new Error("A record ID is required.");
    context.data.collection("entries").remove(input);
  },
}
```

Invoke an action through a button:

```js
ui.button({
  label: "Remove",
  action: "removeEntry",
  input: record.id,
});
```

Do not use writable globals to pass screen or action state.

## SDK 1.1 action controls

SDK 1.1 adds reusable declarative action controls:

```js
ui.action({
  label: "Delete",
  action: "removeEntry",
  input: record.id,
  intent: "destructive",
  disabled: false,
  confirmation: {
    title: "Delete this entry?",
    message: "This cannot be undone.",
    confirmLabel: "Delete",
    cancelLabel: "Keep entry",
  },
});
```

Fields:

- `label`: required visible label.
- `action`: required declared action name.
- `input`: optional finite serializable action input.
- `intent`: optional `"default"` or `"destructive"` presentation.
- `disabled`: optional boolean. Disabled actions cannot be invoked.
- `confirmation`: optional host-owned confirmation metadata.

The host owns the native confirmation dialog. Scripts do not receive callbacks, promises, alert objects, or native components. Cancellation performs no operation; confirmation invokes the action once.

Ordinary buttons support the same optional `intent`, `disabled`, and `confirmation` fields.

## Actionable list items

SDK 1.1 list items may expose up to three actions:

```js
ui.listItem({
  title: String(record.createdAt),
  subtitle: String(record.title),
  trailing: "$12.50",
  actions: [
    ui.action({
      label: "Delete",
      action: "removeEntry",
      input: record.id,
      intent: "destructive",
      confirmation: { title: "Delete this entry?" },
    }),
  ],
});
```

List actions must target declared handlers. Arbitrary children, swipe gestures, custom menus, direct collection bindings, and script-owned modals are not part of SDK 1.1.

## Native UI nodes

Structure and display:

- `ui.page`, `ui.section`, `ui.row`, `ui.column`
- `ui.heading`, `ui.text`, `ui.metric`, `ui.timer`
- `ui.summary`, `ui.list`, `ui.listItem`, `ui.emptyState`

Input and interaction:

- `ui.textInput`, `ui.numberInput`, `ui.toggle`, `ui.select`
- `ui.button`, `ui.navigation`
- SDK 1.1: `ui.action` and `listItem.actions`

Supported display formats are `plain`, `number`, `money`, and `duration`. Arbitrary styles, colors, component names, event handlers, HTML, JSX, and React Native properties are unsupported.

## Timers

```js
context.timers.start("activeTimer");
const timer = context.timers.get("activeTimer");
const stopped = context.timers.stop("activeTimer");
```

Timers are durable host timestamps. A running timer survives process death without keeping JavaScript alive. There is no pause, notification, callback, or arbitrary background-execution API.

## Forbidden and nonexistent APIs

Do not use Node.js modules, React, React Native, Expo, JSX, HTML, network APIs, filesystem APIs, clipboard, location, notifications, secrets, dynamic imports, external packages, remote URLs, timers such as `setTimeout`, raw SQLite, native handles, Android APIs, custom native modules, invented UI builders, invented data methods, migration declarations, or permission manifests.

When an API is not listed in this guide or the committed declarations, it does not exist.

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

The commands execute the same SDK and runner source embedded by the Android native module, then apply the canonical TypeScript validators.

## Final checklist

- [ ] The script imports only from `@pocket-tools/sdk`.
- [ ] The manifest uses lowercase kebab-case and an explicit supported SDK version.
- [ ] `home` exists and every screen/action is synchronous.
- [ ] Every setting, collection, action, screen, and timer reference is valid.
- [ ] Every interaction input is finite and serializable.
- [ ] Every SDK 1.1 action targets a declared handler.
- [ ] Destructive operations use host-owned confirmation where appropriate.
- [ ] No unsupported import, host API, builder, style, or data method appears.
- [ ] The script passes validation and inspection.

## Authoritative references

- [SDK overview](SDK_OVERVIEW.md)
- [SDK TypeScript declarations](../packages/sdk-contract/dist/index.d.ts)
- [Authoring error codes](AUTHORING_ERRORS.md)
- [Runtime and security boundary](SECURITY_MODEL.md)
- [Bathroom Pay SDK 1.1 reference](../examples/bathroom-pay.miniapp.js)
- [Tip Splitter SDK 1.0 compatibility reference](../examples/tip-splitter.miniapp.js)
