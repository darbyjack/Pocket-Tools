# SDK 1.2 Tappable List Rows

## Status

This capability is public in SDK 1.2 and is available through ordinary authoring, validation, inspection, preview, installation, execution, update, rollback, export, backup/restore, and removal paths where applicable.

- `SDK_VERSION` is `"1.2"`.
- Supported manifest versions are `"1.0"`, `"1.1"`, and `"1.2"`.
- The public SDK source, generated declarations, local authoring runtime, embedded QuickJS runtime, host validators, and Android UI/lifecycle paths expose this capability.

Internal source, test, or helper names created during staged implementation may retain `sdk12` or `dormant` compatibility wording. Those names do not gate or expand the public API.

## Dormant node shape

Internally, a list item may declare one primary action:

```js
ui.listItem({
  title: "Electric bill",
  subtitle: "Due August 18",
  trailing: "$142.08",
  primaryAction: ui.action({
    label: "Open electric bill",
    action: "openBill",
    input: { id: "bill-1" },
  }),
  actions: [
    ui.action({
      label: "Mark paid",
      action: "markPaid",
      input: "bill-1",
    }),
  ],
});
```

`primaryAction.label` is required for accessibility and is not rendered as another visible button.

The existing list-item `actions` array remains separate and retains its one-to-three visible-action limit. A primary action does not consume one of those slots.

## Validation

Both the embedded QuickJS runner and the trusted React Native host validate:

- SDK 1.2 is required.
- The action object has only the standard action-control properties.
- The label contains 1 to 120 characters.
- The target action is declared by the tool when the definition is available.
- Input is finite and serializable.
- Intent is `default` or `destructive`.
- Disabled state is boolean.
- Confirmation text uses the existing host bounds.
- A destructive primary action must include confirmation.

Unknown properties, unknown action targets, malformed confirmation objects, and unsafe inputs fail before the row is rendered.

## Host rendering

The informational row summary becomes a host-owned React Native `Pressable` when `primaryAction` exists.

The host provides:

- `accessibilityRole="button"`
- `primaryAction.label` as the accessibility label
- disabled accessibility state
- pressed-state feedback
- disabled presentation on the summary
- host-owned confirmation through the same action path used by buttons

The primary label is not displayed as extra copy, keeping the list visually compact.

## Visible-action isolation

Visible row actions are rendered as siblings of the primary summary press target rather than nested accessible controls. This prevents the primary row target from swallowing the individual buttons in Android accessibility navigation.

Each visible action also stops press propagation before invoking its own action. This defense-in-depth rule guarantees that a visible action cannot trigger the row primary action in the same gesture.

A disabled primary action disables and dims only the summary press target. Independently enabled visible row actions remain available.

## Compatibility

SDK 1.0 and 1.1 list items remain unchanged:

- rows without `primaryAction` render exactly as before
- visible actions keep their current layout and confirmation behavior
- normal host parsing rejects `primaryAction`
- public TypeScript declarations remain unchanged

No persistence, SQLite, backup, timer, query, date, or notification behavior is changed by this slice.

## Coverage

Automated coverage includes:

- valid dormant primary actions
- lower-version and normal-parser rejection
- destructive confirmation requirements
- declared action-target validation
- finite serializable input validation
- exact action and list-item properties
- primary and visible actions in the same row
- explicit visible-action propagation isolation
- Android QuickJS render output

## Required local validation

```powershell
pnpm format
pnpm check

pnpm --dir apps/mobile exec expo prebuild --platform android --clean --no-install
Set-Location apps/mobile/android
.\gradlew.bat :app:assembleDebug connectedDebugAndroidTest
```

Interactive row presses remain part of the final SDK 1.2 activation acceptance because normal installed tools cannot declare SDK 1.2 yet. The activation pass must verify row press, confirmation, disabled state, TalkBack labeling, and visible-action isolation on a physical Android device.
