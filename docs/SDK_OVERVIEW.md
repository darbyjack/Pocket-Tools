# Pocket Tools Offline Mini-App SDK

## Status

Pocket Tools currently supports SDK 1.0 and SDK 1.1. The canonical TypeScript definitions live in `packages/sdk-contract`; the embedded QuickJS module, runtime protocol, host validators, renderer, SQLite operation path, examples, and documentation implement the same contract.

- SDK 1.0 is the original frozen Android MVP surface.
- SDK 1.1 is an additive release for richer, host-controlled action presentation.
- Legacy numeric `sdkVersion: 1` is normalized to SDK 1.0 for already-installed scripts.
- New scripts declare an explicit `"1.0"` or `"1.1"` capability version.

A script must declare the lowest SDK version whose features it uses. Unsupported versions are rejected before installation.

## SDK 1.2 planning status

The complete [SDK 1.2 contract](SDK_1_2_CONTRACT.md) is frozen for implementation planning, but SDK 1.2 is **not yet supported**.

Until the final activation slice is complete:

- `SDK_VERSION` remains `"1.1"`.
- Manifests must continue to declare `"1.0"` or `"1.1"`.
- Generated declarations and the embedded QuickJS module do not expose 1.2 APIs.
- Individual implementation slices may add internal support, but no incomplete public capability may be advertised to scripts or authoring agents.

The frozen 1.2 scope covers transactional form-state writes, date-aware inputs, tappable rows, richer bounded queries and aggregates, host feedback, copy/share output, local reminders, Android notification recovery, and phone notification bridging to a paired Galaxy Watch. The contract defines the exact public shapes, operation and effect ordering, persistence rules, limits, exclusions, compatibility matrix, and activation boundary.

## Common offline surface

Both supported versions provide:

- Durable typed settings.
- Isolated typed collections with `insert`, `get`, `update`, `remove`, `query`, `count`, and `sum`.
- Named synchronous screens and actions with finite serializable input.
- Declarative native pages, sections, rows, columns, text, metrics, timers, settings controls, navigation, summaries, lists, list items, and empty states.
- Durable host-managed timers.
- Exact validation of definitions, values, operations, UI trees, action targets, screen targets, size limits, and bridge values.

The supported SDK remains offline-only. It exposes no network, filesystem, location, notification, secret, native-module, arbitrary component, or arbitrary background-JavaScript access.

## Version declarations

```js
manifest: {
  id: "example-tool",
  name: "Example Tool",
  sdkVersion: "1.1",
}
```

A 1.1 host accepts 1.0 and 1.1 scripts. A script declaring 1.1 must not be installed by a host that supports only 1.0.

## SDK 1.1 additions

SDK 1.1 adds one reusable action-control contract:

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

The same optional `intent`, `disabled`, and `confirmation` fields are available on `ui.button`.

### Actionable list items

```js
ui.listItem({
  title: String(record.createdAt),
  subtitle: String(record.title),
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

A list item may expose one to three action controls. Every action must target a declared handler and carry only finite serializable input.

### Host-owned behavior

- Confirmation is rendered by the host.
- Cancellation performs no operation.
- Confirmation invokes the action once and rerenders the active screen.
- A disabled action cannot be invoked.
- `destructive` is a presentation intent only; the script still performs the requested operation inside its declared action.
- Scripts never receive native alert objects, callbacks, promises, mutable controls, or direct database bindings.

## Collections and record-targeted actions

The host owns record IDs and timestamps. A script can pass a selected record ID into an action:

```js
actions: {
  removeEntry(context, input) {
    if (typeof input !== "string") throw new Error("A record ID is required.");
    context.data.collection("entries").remove(input);
  },
}
```

All operations requested by one action are validated and applied transactionally by the host.

## UI and bridge limits

- Maximum rendered UI nodes: 512.
- Maximum UI depth: 16.
- Maximum list-item actions: 3.
- Interaction values must be finite serializable values.
- Unknown properties, unsupported nodes, undeclared targets, invalid confirmation metadata, and incompatible setting bindings are rejected.

## Deliberate exclusions from SDK 1.1

SDK 1.1 does not add:

- Swipe actions.
- Arbitrary list-item children.
- Script-owned modals.
- Custom icons or menu systems.
- Direct collection-operation bindings.
- Network, filesystem, location, notification, secret, or custom-native APIs.
- Pause/resume timer APIs or arbitrary background execution.

Future public surface requires another explicit SDK version decision and must be implemented through the entire contract path. SDK 1.2 follows that rule and remains disabled until its complete frozen contract is implemented.

## Authoritative references

- [`AGENT_AUTHORING.md`](AGENT_AUTHORING.md)
- [`SDK_1_2_CONTRACT.md`](SDK_1_2_CONTRACT.md)
- [`packages/sdk-contract/dist/index.d.ts`](../packages/sdk-contract/dist/index.d.ts)
- [`SECURITY_MODEL.md`](SECURITY_MODEL.md)
- [`AUTHORING_ERRORS.md`](AUTHORING_ERRORS.md)
- SDK 1.1 reference: [`examples/bathroom-pay.miniapp.js`](../examples/bathroom-pay.miniapp.js)
- SDK 1.0 compatibility reference: [`examples/tip-splitter.miniapp.js`](../examples/tip-splitter.miniapp.js)
