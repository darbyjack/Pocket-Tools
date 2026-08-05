# SDK 1.2 UI and Output

This document groups the released SDK 1.2 UI and host-effect additions. Exact shapes and limits remain authoritative in the [SDK 1.2 Contract](SDK_1_2_CONTRACT.md) and generated declarations.

## Tappable list rows

A list item may define one `primaryAction` for the row and up to three visible actions.

```js
ui.listItem({
  title: "Quarterly report",
  leadingIcon: "calendar",
  primaryAction: ui.action({
    label: "Open report",
    action: "openReport",
    input: report.id,
  }),
  actions: [
    ui.action({
      label: "Delete report",
      action: "deleteReport",
      input: report.id,
      icon: "delete",
      intent: "destructive",
      confirmation: { title: "Delete this report?" },
    }),
  ],
});
```

The host isolates event propagation: tapping a visible action does not also invoke the row action. Destructive primary actions require host-owned confirmation. Labels remain the accessibility authority.

## Multiline and numeric input hints

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

`minLines` is valid only with `multiline: true` and is bounded by the contract. `step` and `decimalPlaces` are host input hints; they do not replace setting validation or perform arithmetic rounding.

Scripts cannot choose arbitrary keyboard implementations, dimensions, styles, fonts, or native input components.

## Badges

```js
ui.badge({ text: "Ready", tone: "success" });
```

Supported tones are `neutral`, `info`, `success`, `warning`, and `danger`. Omitted tone is neutral. Text supplies the accessible status; tone supplies host-owned semantics.

## Progress

```js
ui.progress({
  label: "Completed",
  value: 15,
  min: 10,
  max: 30,
  format: "percent",
});
```

The default range is 0 through 100. Bounds and values must be finite, and `max` must exceed `min`. The host clamps the visual bar but preserves the original value in accessibility text. Percent format is progress through the declared range.

## Fixed host icons

Supported names are:

`add`, `edit`, `delete`, `check`, `calendar`, `clock`, `copy`, `share`, `search`, `settings`, `warning`, `info`, `money`, `list`, and `refresh`.

Icons are decorative host assets. Scripts cannot provide custom SVG, images, URLs, packages, colors, sizes, or drawing data. Every button and action still requires a visible label.

## Feedback

```js
context.feedback.show("Saved");
```

An action may request at most one bounded feedback effect. The host displays it only after durable operations commit and the active screen rerenders. Scripts do not receive a toast, snackbar, callback, or presentation handle.

## Copy and share

```js
context.output.copy("Copied text");

context.output.share({
  title: "Pocket Tools",
  text: "Shared text",
});
```

An action may request at most one output effect: copy or share. The host performs the effect after commit. Scripts cannot read the clipboard, share files, choose arbitrary MIME types, observe the share result, or undo committed state when a share sheet is canceled.

## Validation and accessibility

The host validates:

- exact node and effect keys
- manifest-version gates
- compatible setting bindings
- declared action targets and finite serializable input
- fixed icon names
- bounded text and numeric values
- UI node count and depth
- one feedback and one output effect per action

React Native owns layout, large-font behavior, TalkBack semantics, confirmation dialogs, disabled state, destructive presentation, and tap isolation. Arbitrary style objects, components, event handlers, JSX, HTML, and native props are unsupported.
