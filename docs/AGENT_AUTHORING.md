# Pocket Tools SDK 1.2 Agent Authoring Guide

This is the canonical starting point for an agent producing one Pocket Tools mini-app. Use only the API documented here and in the committed TypeScript declarations.

## Required output

Return exactly one UTF-8 JavaScript ES module, normally named `<tool-id>.miniapp.js`.

The script must:

1. Import only from `@pocket-tools/sdk`.
2. Default-export one `defineMiniApp(...)` result.
3. Declare `sdkVersion: "1.2"` for new scripts.
4. Declare a synchronous `home` screen.
5. Use lowercase kebab-case for `manifest.id`.
6. Use lower camelCase for settings, collections, screens, actions, timer IDs, and notification IDs.
7. Use only finite JSON-compatible values across the SDK boundary.
8. Keep all business logic in the script and all platform behavior in documented host clients.
9. Avoid top-level await and asynchronous screens or actions.
10. Pass local validation and inspection before delivery.

SDK 1.2 hosts continue to run SDK 1.0 and SDK 1.1 scripts. Legacy numeric `sdkVersion: 1` is read as SDK 1.0 for already-installed scripts, but new source must use an explicit string version.

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
    sdkVersion: "1.2",
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
  sdkVersion: "1.2",
}
```

- `"1.0"` is the original frozen offline surface.
- `"1.1"` adds action intent, disabled controls, host confirmation, and visible list actions.
- `"1.2"` adds transactional setting writes, date-aware data, bounded multi-select, richer queries and aggregates, tappable rows, host feedback, copy/share output, local notifications, multiline/numeric hints, badges, progress, and fixed host icons.
- A script must declare the lowest version whose features it uses.
- Unsupported versions and higher-version fields are rejected before installation.

## Settings

Available definitions:

- `setting.text({ label, default, description?, minLength?, maxLength?, visibleWhen? })`
- `setting.boolean({ label, default, description?, visibleWhen? })`
- `setting.number({ label, default, description?, min?, max?, visibleWhen? })`
- `setting.money({ label, default, description?, min?, max?, visibleWhen? })`
- `setting.date({ label, default, description?, min?, max?, visibleWhen? })`
- `setting.datetime({ label, default, description?, min?, max?, visibleWhen? })`
- `setting.select({ label, default, description?, options, visibleWhen? })`
- `setting.multiSelect({ label, default, description?, options, minSelections?, maxSelections? })`

Read and write settings through the context:

```js
const title = context.settings.get("title");
context.settings.set("title", "Saved");
context.settings.reset("temporaryFilter");
```

`set` and `reset` are action-only operations. The host validates them against the declared setting and commits them transactionally with record operations.

### Date values

- Date values use canonical `YYYY-MM-DD`, such as `2026-08-04`.
- Date-time values use canonical UTC ISO strings with milliseconds, such as `2026-08-04T23:30:00.000Z`.
- `min` and `max` use the same canonical representation as the setting or field.
- Do not provide locale-formatted dates, offsets, missing milliseconds, or impossible calendar dates.

### Multi-select values

A multi-select default is an array of declared option values:

```js
tags: setting.multiSelect({
  label: "Tags",
  options: [
    { label: "Work", value: "work" },
    { label: "Personal", value: "personal" },
  ],
  default: ["work"],
  minSelections: 1,
  maxSelections: 2,
}),
```

Values must contain no duplicates, must appear in declared option order, and must satisfy the selection bounds. Multi-select settings cannot be used as `visibleWhen.setting` because visibility equality is scalar.

## Collections and records

```js
collections: {
  entries: collection({
    title: field.text({ maxLength: 200 }),
    complete: field.boolean(),
    amount: field.money({ optional: true, min: 0 }),
    dueDate: field.date({ optional: true }),
    recordedAt: field.datetime({ optional: true }),
  }),
}
```

Available fields are `text`, `boolean`, `number`, `money`, `date`, and `datetime`. Fields are required unless `optional: true`.

The host owns `id`, `createdAt`, and `updatedAt`. Use the collection client inside screens and actions:

```js
const entries = context.data.collection("entries");
entries.insert({
  title: "Example",
  complete: false,
  amount: null,
  dueDate: null,
  recordedAt: null,
});
const record = entries.get(recordId);
entries.update(recordId, { complete: true });
entries.remove(recordId);
const records = entries.query(query);
const count = entries.count(query);
const total = entries.sum("amount", query);
const minimum = entries.min("amount", query);
const maximum = entries.max("amount", query);
const average = entries.average("amount", query);
```

Writes requested by one action are applied transactionally by the host. Screens may read but must not attempt writes.

### Queries

```js
const recentOpenEntries = entries.query({
  where: [
    { field: "complete", operator: "eq", value: false },
    { field: "title", operator: "contains", value: "report" },
  ],
  orderBy: [{ field: "createdAt", direction: "desc" }],
  limit: 20,
  offset: 0,
});
```

Documented operators are `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `contains`, and `startsWith`. The host permits only operators compatible with the declared field type. Metadata fields may be queried only where documented by the declarations and host validator.

`sum`, `min`, `max`, and `average` accept numeric fields only. Empty `min`, `max`, and `average` results are `null`.

## Screens, actions, and interaction input

Screens and actions are synchronous. Their optional second argument is `SerializableValue | undefined`. Narrow it before use.

```js
actions: {
  removeEntry(context, input) {
    if (typeof input !== "string") throw new Error("A record ID is required.");
    context.data.collection("entries").remove(input);
    context.feedback.show("Entry removed");
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

## Action controls and tappable rows

Reusable action controls support:

```js
ui.action({
  label: "Delete",
  action: "removeEntry",
  input: record.id,
  icon: "delete",
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

- `label`: required visible and accessibility label.
- `action`: required declared action name.
- `input`: optional finite serializable input.
- `intent`: optional `"default"` or `"destructive"` presentation.
- `disabled`: optional boolean.
- `confirmation`: optional host-owned confirmation metadata.
- `icon`: optional fixed host icon name.

Buttons support the same fields.

A list item may have one primary row action and up to three visible actions:

```js
ui.listItem({
  title: String(record.title),
  subtitle: String(record.createdAt),
  trailing: "$12.50",
  leadingIcon: "calendar",
  primaryAction: ui.action({
    label: "Open entry",
    action: "openEntry",
    input: record.id,
    icon: "edit",
  }),
  actions: [
    ui.action({
      label: "Delete",
      action: "removeEntry",
      input: record.id,
      icon: "delete",
      intent: "destructive",
      confirmation: { title: "Delete this entry?" },
    }),
  ],
});
```

The host isolates row and visible-action taps. A visible action must not also invoke the primary row action. Destructive primary actions require confirmation.

## Fixed host icons

Supported icon names are:

`add`, `edit`, `delete`, `check`, `calendar`, `clock`, `copy`, `share`, `search`, `settings`, `warning`, `info`, `money`, `list`, and `refresh`.

Icons are decorative and host-owned. Labels remain mandatory. Do not provide custom SVG, image, URL, package, color, size, or drawing data.

## Native UI nodes

Structure and display:

- `ui.page`, `ui.section`, `ui.row`, `ui.column`
- `ui.heading`, `ui.text`, `ui.badge`, `ui.progress`
- `ui.metric`, `ui.timer`, `ui.summary`
- `ui.list`, `ui.listItem`, `ui.emptyState`

Input and interaction:

- `ui.textInput`, `ui.numberInput`, `ui.toggle`, `ui.select`
- `ui.dateInput`, `ui.datetimeInput`, `ui.multiSelect`
- `ui.button`, `ui.action`, `ui.navigation`

Supported display formats are `plain`, `number`, `money`, and `duration`. Arbitrary styles, colors, component names, event handlers, HTML, JSX, and React Native properties are unsupported.

### Multiline text and numeric hints

```js
ui.textInput({
  setting: "notes",
  label: "Notes",
  multiline: true,
  minLines: 4,
});

ui.numberInput({
  setting: "amount",
  label: "Amount",
  step: 0.01,
  decimalPlaces: 2,
});
```

`minLines` is valid only with `multiline: true` and must be an integer from 2 through 8. `step` must be finite and greater than zero. `decimalPlaces` is an integer from 0 through 6. These are host input hints, not arithmetic rounding rules.

### Badges

```js
ui.badge({ text: "Ready", tone: "success" });
```

Tones are `neutral`, `info`, `success`, `warning`, and `danger`. Omitted tone is neutral. Badge text is the accessibility content; tone adds semantic status.

### Progress

```js
ui.progress({
  label: "Upload",
  value: 15,
  min: 10,
  max: 30,
  format: "percent",
});
```

Defaults are `min: 0` and `max: 100`. `max` must be greater than `min`. Values and bounds must be finite. The host clamps the visual bar but preserves the original value in accessibility text. Percent is progress through the declared range, not `value / max` unless `min` is zero.

## Timers

```js
context.timers.start("activeTimer");
const timer = context.timers.get("activeTimer");
const stopped = context.timers.stop("activeTimer");
```

Timers are durable host timestamps. A running timer survives process death without keeping JavaScript alive. There is no pause, callback, or arbitrary background-execution API.

## Feedback and copy/share output

Actions may request host effects:

```js
context.feedback.show("Saved");
context.output.copy("Copied text");
context.output.share({
  title: "Pocket Tools",
  text: "Shared text",
});
```

Feedback messages are short host-owned acknowledgements. Copy and share are explicit user-facing outputs. An action may request at most one feedback effect and at most one output effect. Effects run only after durable operations commit.

## Local notifications

Schedule notifications only inside actions:

```js
context.notifications.schedule({
  id: "dailyReminder",
  title: "Review entries",
  body: "Open Pocket Tools to continue.",
  trigger: {
    type: "daily",
    hour: 17,
    minute: 0,
    delivery: "standard",
  },
  open: {
    screen: "home",
  },
});
```

Other triggers:

```js
{ type: "immediate" }

{
  type: "date",
  at: "2026-08-05T17:00:00.000Z",
  delivery: "exact",
}

{
  type: "weekly",
  weekday: 1,
  hour: 9,
  minute: 30,
  delivery: "standard",
}
```

Cancel by stable ID or cancel all notifications owned by the tool:

```js
context.notifications.cancel("dailyReminder");
context.notifications.cancelAll();
```

Rules:

- IDs use lower camelCase and are stable within the tool.
- `open.screen` must name a declared screen.
- `open.input` must be finite and serializable.
- Date triggers use canonical UTC date-time strings.
- Daily and weekly times are interpreted by the host in local time.
- Weekday values are 1 through 7.
- `standard` is the default delivery.
- `exact` is never silently downgraded. Scheduling an exact reminder without exact-alarm access fails before persistence; an exact reminder restored from backup remains blocked until access is granted.
- The host owns permission prompts, channels, reconciliation, startup recovery, removal cleanup, and tap routing.
- Scripts cannot inspect Android permissions, delivery success, paired watches, or Galaxy Wearable settings.

## Lifecycle behavior

A valid SDK 1.2 script participates in normal Pocket Tools flows:

- Validate and inspect.
- Preview and install.
- Update and roll back.
- Duplicate and export.
- Back up and restore.
- Reopen after process death.
- Remove with or without deleting data.
- Reconcile notifications on startup, restore, update, and removal.

Do not add migration declarations or compatibility layers. The host validates current source against existing persisted values and applies the documented lifecycle atomically.

## Forbidden and nonexistent APIs

Do not use:

- Node.js modules or general web APIs.
- React, React Native, Expo, JSX, or HTML.
- Network, filesystem, location, secret, sensor, camera, Bluetooth, or raw clipboard APIs.
- Dynamic imports, external packages, re-exports, or remote URLs.
- `setTimeout`, `setInterval`, workers, background callbacks, or promises.
- Raw SQLite, native handles, Android APIs, custom native modules, or permission manifests.
- Custom UI components, arbitrary styles, custom icons, swipe gestures, script-owned modals, or custom menus.
- Invented builders, data methods, notification fields, delivery callbacks, or host capabilities.

Documented `context.output.copy`, `context.output.share`, and `context.notifications` are the only clipboard/share/notification surfaces. When an API is not listed in this guide or the committed declarations, it does not exist.

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

The commands execute the same composed SDK and runner wrapper chain used by the Android native module, then apply the canonical TypeScript validators.

## Final checklist

- [ ] The script imports only from `@pocket-tools/sdk`.
- [ ] The manifest uses lowercase kebab-case and `sdkVersion: "1.2"`.
- [ ] `home` exists and every screen/action is synchronous.
- [ ] Every setting, collection, action, screen, timer, and notification reference is valid.
- [ ] Every value and interaction input is finite and serializable.
- [ ] Dates and date-times are canonical.
- [ ] Multi-select values are ordered, unique, and within bounds.
- [ ] Record and setting writes occur only inside actions.
- [ ] Destructive operations use host-owned confirmation where appropriate.
- [ ] Row actions and visible actions are distinct and correctly labeled.
- [ ] Icons use only the fixed host names and every control retains a text label.
- [ ] Notification open targets name declared screens.
- [ ] No unsupported import, host API, builder, style, or data method appears.
- [ ] The script passes validation and inspection.

## Authoritative references

- [SDK overview](SDK_OVERVIEW.md)
- [SDK TypeScript declarations](../packages/sdk-contract/dist/index.d.ts)
- [Authoring error codes](AUTHORING_ERRORS.md)
- [Runtime and security boundary](SECURITY_MODEL.md)
- [Frozen SDK 1.2 contract](SDK_1_2_CONTRACT.md)
- [Bathroom Pay SDK 1.1 compatibility reference](../examples/bathroom-pay.miniapp.js)
- [Tip Splitter SDK 1.0 compatibility reference](../examples/tip-splitter.miniapp.js)
