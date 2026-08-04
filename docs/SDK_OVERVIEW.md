# Pocket Tools Offline Mini-App SDK

## Status

Pocket Tools supports SDK `"1.0"`, `"1.1"`, and `"1.2"`. The current public version is `"1.2"`.

The canonical TypeScript definitions live in `packages/sdk-contract`. The embedded QuickJS SDK and runner, local authoring tools, runtime protocol, host validators, native renderer, SQLite persistence layer, notification runtime, backup/restore flow, examples, and documentation implement the same contract.

- SDK 1.0 is the original frozen Android MVP surface.
- SDK 1.1 adds richer host-controlled action presentation.
- SDK 1.2 adds transactional setting writes, richer typed data, additional host-owned UI, feedback/output effects, and local notifications.
- Legacy numeric `sdkVersion: 1` is normalized to SDK 1.0 for already-installed scripts.
- New scripts declare an explicit string version and should use `"1.2"` unless they intentionally target an older host.

A script must declare the lowest SDK version whose capabilities it uses. Unknown versions and 1.2-only fields under 1.0/1.1 are rejected before installation.

## Security and execution model

Mini-apps are synchronous JavaScript ES modules executed inside a bounded QuickJS sandbox. They import only `@pocket-tools/sdk` and return declarative data for the host to validate and render.

The SDK remains offline-first and host-owned:

- No arbitrary network, filesystem, location, secrets, Android APIs, native modules, React Native components, JSX, HTML, or external packages.
- No arbitrary background JavaScript, callbacks, promises, or long-running workers.
- No custom SVG, image, icon package, style object, color, or component injection.
- No direct SQLite access or host handles.
- All bridge values must be finite and serializable.
- Definitions, UI, operations, effects, queries, and notification requests are validated exactly; unknown properties are rejected.

## Common surface

All supported versions provide:

- Durable typed settings.
- Isolated typed collections.
- Named synchronous screens and actions.
- Declarative native pages, sections, rows, columns, text, metrics, timers, settings controls, navigation, summaries, lists, list items, and empty states.
- Durable host-managed timers.
- Exact validation and transactional host persistence.

## SDK 1.1 additions

SDK 1.1 adds reusable host-owned action presentation:

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

The same optional `intent`, `disabled`, and `confirmation` fields are available on `ui.button`. List items may expose up to three action controls.

The host owns confirmation, cancellation, disabled behavior, and invocation isolation. Scripts never receive native alert objects or callbacks.

## SDK 1.2 additions

### Transactional setting writes

Actions may update or reset declared settings:

```js
actions: {
  save(context) {
    context.settings.set("draftTitle", "Saved");
    context.settings.reset("temporaryFilter");
  },
}
```

Setting and collection writes requested by one action are validated and committed atomically. A failure rolls back the complete action transaction.

### Date, date-time, and bounded multi-select settings

SDK 1.2 adds:

- `setting.date(...)`
- `setting.datetime(...)`
- `setting.multiSelect(...)`
- `field.date(...)`
- Canonical bounded `field.datetime(...)`
- `ui.dateInput(...)`
- `ui.datetimeInput(...)`
- `ui.multiSelect(...)`

Dates use canonical `YYYY-MM-DD`. Date-times use canonical UTC ISO strings with millisecond precision, such as `2026-08-04T23:30:00.000Z`.

Multi-select values preserve declared option order, contain no duplicates, and obey optional `minSelections` and `maxSelections` bounds. Multi-select settings cannot drive `visibleWhen` equality comparisons.

### Form hints

- `ui.textInput({ multiline: true, minLines? })`
- `ui.numberInput({ step?, decimalPlaces? })`

These are bounded host rendering and input hints. Scripts do not control fonts, heights, keyboard implementations, or arbitrary styling.

### Everyday queries and aggregates

Collection clients support:

- `insert`, `get`, `update`, and `remove`
- `query({ where?, orderBy?, limit?, offset? })`
- `count(query?)`
- `sum(fieldName, query?)`

Filters support the documented `eq`, `gte`, and `lte` operators where valid for the declared field type. Ordering, limits, offsets, metadata fields, numeric aggregates, and query complexity are host-bounded.

### Host-owned UI

SDK 1.2 adds:

- `listItem.primaryAction` for a tappable row.
- `ui.badge({ text, tone? })` with neutral, info, success, warning, or danger semantics.
- `ui.progress({ label?, value, min?, max?, format? })`.
- Fixed semantic icons on buttons/actions and leading list-item icons.

Fixed icon names are:

`add`, `edit`, `delete`, `check`, `calendar`, `clock`, `copy`, `share`, `search`, `settings`, `warning`, `info`, `money`, `list`, and `refresh`.

Labels remain mandatory and authoritative for accessibility. Icons are decorative, host-rendered, and cannot be customized by scripts.

Progress defaults to a range of 0 through 100. The host clamps visual presentation while preserving the original finite value in accessibility text. Percent format is calculated through the declared range.

### Feedback and output

Actions may request:

```js
context.feedback.show("Saved");
context.output.copy("Copied text");
context.output.share({ title: "Pocket Tools", text: "Shared text" });
```

Feedback and output are host effects. They execute only after durable operations commit. An action may request at most one feedback effect and at most one copy/share effect.

### Local notifications

Actions may schedule or cancel host-owned local notifications:

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
  open: { screen: "home" },
});
```

Supported triggers are:

- Immediate.
- One canonical UTC date-time.
- Daily at a host-local hour and minute.
- Weekly using weekday 1 through 7 plus hour and minute.

Scheduled date, daily, and weekly notifications may request `standard` or `exact` delivery. Exact delivery is best-effort and may fall back according to Android capability and permission state.

The host owns permission prompts, channels, scheduling, reconciliation, startup recovery, removal cleanup, tap routing, and Android notification behavior. A notification `open.screen` must reference a declared screen and may carry finite serializable input.

Phone notifications can mirror to a paired Galaxy Watch through Android and Galaxy Wearable settings. The mini-app has no watch API and cannot require or inspect mirroring.

## Lifecycle and recovery

SDK 1.2 participates in the normal host lifecycle:

- Local validation and inspection.
- Preview and installation.
- Update and rollback.
- Duplication and export.
- Single-tool and complete-host backup/restore.
- Process death and startup recovery.
- Tool removal with optional data deletion.
- Notification reconciliation and tap routing.

Backup format v2 includes the notification registry required to reconcile restored tools. Preview namespaces remain isolated and are cleared on startup.

## Compatibility

A 1.2 host must preserve existing 1.0 and 1.1 behavior:

- Lower-version scripts do not gain 1.2 capabilities implicitly.
- 1.2-only definitions and UI under 1.0/1.1 fail validation.
- Legacy 1.0 date-time fields retain their existing compatibility rules.
- Existing action presentation, timers, records, backups, updates, and rollbacks remain valid.

## UI and bridge limits

Core limits include:

- Maximum rendered UI nodes: 512.
- Maximum UI depth: 16.
- Maximum list-item visible actions: 3.
- Finite serializable interaction and notification input.
- Bounded text, option, query, effect, and notification sizes.
- No circular, prototype-bearing, unsafe-key, or undeclared bridge objects.

Consult the TypeScript declarations and authoring guide for exact per-field bounds.

## Authoritative references

- [`AGENT_AUTHORING.md`](AGENT_AUTHORING.md)
- [`AGENT_PROMPT.md`](AGENT_PROMPT.md)
- [`SDK_1_2_CONTRACT.md`](SDK_1_2_CONTRACT.md)
- [`packages/sdk-contract/dist/index.d.ts`](../packages/sdk-contract/dist/index.d.ts)
- [`AUTHORING_ERRORS.md`](AUTHORING_ERRORS.md)
- [`SECURITY_MODEL.md`](SECURITY_MODEL.md)
- SDK 1.1 compatibility reference: [`examples/bathroom-pay.miniapp.js`](../examples/bathroom-pay.miniapp.js)
- SDK 1.0 compatibility reference: [`examples/tip-splitter.miniapp.js`](../examples/tip-splitter.miniapp.js)
