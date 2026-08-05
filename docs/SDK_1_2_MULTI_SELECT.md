# SDK 1.2 bounded multi-select settings

## Status

This capability is public in SDK 1.2 and is available through ordinary authoring, validation, inspection, preview, installation, execution, update, rollback, export, backup/restore, and removal paths where applicable.

- `SDK_VERSION` is `"1.2"`.
- Supported manifest versions are `"1.0"`, `"1.1"`, and `"1.2"`.
- The public SDK source, generated declarations, local authoring runtime, embedded QuickJS runtime, host validators, and Android UI/lifecycle paths expose this capability.

Internal source, test, or helper names created during staged implementation may retain `sdk12` or `dormant` compatibility wording. Those names do not gate or expand the public API.

## Frozen contract

```ts
const tags = setting.multiSelect({
  label: "Tags",
  description: "Choose the categories that apply.",
  options: [
    { label: "Work", value: "work" },
    { label: "Personal", value: "personal" },
    { label: "Pinned", value: true },
  ],
  default: ["work"],
  minSelections: 1,
  maxSelections: 2,
});

ui.multiSelect({
  setting: "tags",
  label: "Tags",
});
```

`SelectValue` remains a finite string, number, or boolean. Option labels and values use the existing select-option rules.

## Definition validation

A multi-select definition:

- requires SDK 1.2;
- contains between 1 and 100 options;
- contains unique option values;
- uses an array default containing declared values only;
- contains no duplicate default values;
- accepts optional integer `minSelections` and `maxSelections` values from zero through the option count;
- requires the minimum not to exceed the maximum;
- requires the default to satisfy the declared selection bounds;
- rejects unknown properties;
- cannot be the setting referenced by a `visibleWhen` comparison.

A default may be written in any unique order. Inspection normalizes it into option declaration order.

## Stored value invariant

Every stored multi-select value is a serializable array that:

- contains declared option values only;
- contains no duplicates;
- satisfies the selection bounds;
- follows option declaration order.

The order is never based on tap order. This gives settings, previews, transactions, backups, restores, action snapshots, and rerenders one deterministic representation.

The trusted host validates the invariant when it:

- creates setting defaults;
- applies a direct host setting change;
- loads a stored runtime snapshot;
- applies an SDK 1.2 `setting-set` operation;
- applies an SDK 1.2 `setting-reset` operation;
- validates restored setting data.

Multi-select uses the existing serializable setting container. It does not require a schema migration or another backup-format version.

## Embedded QuickJS behavior

The dormant embedded SDK exposes:

- `setting.multiSelect(...)`;
- `ui.multiSelect(...)`;
- `context.settings.get(...)` returning an ordinary array;
- `context.settings.set(...)` accepting a unique set of declared values and recording the canonical array;
- `context.settings.reset(...)` restoring the canonical default.

The native layer internally adapts multi-select data through the established runner, then restores the public dormant shapes before returning inspection, UI, or operations to the trusted host. Scripts never observe the internal representation.

SDK 1.0 and 1.1 definitions cannot declare a multi-select setting or input. Their contexts and behavior remain unchanged.

## Host-owned Android control

The React Native host renders option chips as accessible checkboxes.

Selection changes remain local until the user chooses **Apply**. This is required for exact-count definitions where `minSelections` equals `maxSelections`: the user can temporarily deselect one option, select its replacement, and then commit a valid final set.

Host behavior:

- selected count and bounds are displayed;
- selecting an additional option is disabled at the maximum;
- temporary drafts below the minimum are allowed but cannot be applied;
- **Discard** restores the persisted value;
- **Apply** writes one canonical array through the existing trusted setting path;
- TalkBack receives checkbox checked/disabled state and a bounded-selection hint;
- scripts cannot define colors, layouts, native components, callbacks, or styling.

## Deliberate exclusions

This slice does not add:

- multi-select collection fields;
- array query operators or aggregates;
- arbitrary option rendering;
- searchable or remotely loaded options;
- custom colors, icons, components, or layout controls;
- multi-select `visibleWhen` comparisons;
- public SDK 1.2 activation.

## Automated validation

Run from the repository root:

```powershell
pnpm format
pnpm check
```

Regenerate Android and run the complete connected suite because the native QuickJS source selection changes:

```powershell
pnpm --dir apps/mobile exec expo prebuild `
  --platform android `
  --clean `
  --no-install

Set-Location apps/mobile/android
.\gradlew.bat :app:assembleDebug connectedDebugAndroidTest --max-workers=4
```

Coverage includes:

- definition normalization and malformed bounds/defaults/options;
- canonical value ordering;
- unknown, duplicate, too-small, and too-large selections;
- dormant protocol preservation and normal-parser rejection;
- exact UI keys and compatible binding;
- embedded inspection, rendering, action writes, same-action reads, reset, and stored-snapshot validation;
- SDK 1.0 and SDK 1.1 rejection and regression coverage.

## Galaxy S24 Ultra acceptance

Physical acceptance was completed with a temporary diagnostics-only dormant SDK 1.2 fixture. The fixture was removed before merge.

Verified behavior:

1. A multi-select control renders every option with the expected label.
2. TalkBack announces each option as a checkbox and reports checked state.
3. Selecting and deselecting options updates the displayed count without immediately writing storage.
4. **Apply** is disabled below `minSelections` and enabled for a valid changed selection.
5. New options cannot be selected after `maxSelections` is reached.
6. An exact-count setting permits replacing one selected option by drafting below the minimum and then selecting the replacement.
7. **Discard** restores the last persisted selection.
8. **Apply** persists values in declaration order, independent of tap order.
9. The selection survives navigation, application background/foreground, force-stop, and relaunch.
10. Action-driven setting set/reset operations update the control and restore the default.
11. Preview state remains isolated from installed state.
12. Update, rollback, portable backup/restore, and complete-host backup/restore retain the same canonical array.
