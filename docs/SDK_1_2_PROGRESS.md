# SDK 1.2 host-owned progress nodes

## Status

This capability is public in SDK 1.2 and is available through ordinary authoring, validation, inspection, preview, installation, execution, update, rollback, export, backup/restore, and removal paths where applicable.

- `SDK_VERSION` is `"1.2"`.
- Supported manifest versions are `"1.0"`, `"1.1"`, and `"1.2"`.
- The public SDK source, generated declarations, local authoring runtime, embedded QuickJS runtime, host validators, and Android UI/lifecycle paths expose this capability.

Internal source, test, or helper names created during staged implementation may retain `sdk12` or `dormant` compatibility wording. Those names do not gate or expand the public API.

## Frozen contract

```ts
interface ProgressNode extends UiNodeBase<"progress"> {
  readonly label?: string;
  readonly value: number;
  readonly min?: number;
  readonly max?: number;
  readonly format?: "number" | "percent";
}

ui.progress({
  label: "Completed",
  value: 7,
  min: 0,
  max: 10,
  format: "number",
});
```

## Validation

A progress node:

- requires SDK 1.2;
- contains exact keys `type`, optional `label`, `value`, optional `min`, optional `max`, and optional `format`;
- requires finite numeric values and bounds;
- defaults `min` to `0` and `max` to `100`;
- requires `max` to be greater than `min`;
- accepts only `number` or `percent` formatting;
- allows a finite value below `min` or above `max` so the host can clamp visual presentation while retaining the original value for accessibility;
- rejects script-provided colors, styles, animations, children, components, callbacks, and drawing controls.

Progress nodes may appear anywhere an ordinary leaf UI node is valid, including inside host-owned sections, rows, and columns. Existing layout depth and node-count limits still apply.

## Percent semantics

Percent is progress through the declared range:

```text
(value - min) / (max - min)
```

The result used for visual presentation is clamped to `0` through `1`.

Examples:

- value `25`, range `0` to `100` → `25%`
- value `15`, range `10` to `30` → `25%`
- value `150`, range `0` to `100` → visually `100%`, with original value `150` retained for accessibility
- value `-5`, range `0` to `10` → visually `0%`, with original value `-5` retained for accessibility

A percent format does not require callers to supply a 0-to-100 input.

## Embedded QuickJS behavior

The dormant embedded SDK exposes `ui.progress(...)` only through the internal SDK 1.2 runtime layer.

Before the legacy runner validates a rendered page, the progress layer:

1. validates exact keys, SDK version, finite values, bounds, format, bridge depth, complexity, and circular references;
2. records the original progress definition by its page path;
3. adapts the progress node to a legacy text node without exposing that representation to the script or host;
4. lets every established QuickJS and bridge validator process the complete page;
5. restores the original progress node before returning the trusted result.

The progress layer composes over the badge layer, which composes over every prior dormant SDK 1.2 runtime layer. SDK 1.0 and SDK 1.1 scripts cannot render progress nodes and retain their existing UI behavior.

## Host-owned Android presentation

Pocket Tools renders progress as a fixed host-owned track and fill with:

- an optional text label;
- a host-formatted number or percent value;
- a clamped fill between empty and full;
- no script-selected color, size, animation, or custom drawing.

The visual number and fill use the clamped value. The accessibility value includes:

- the declared minimum and maximum;
- the clamped current value expected by the Android progress-bar role;
- host-owned text containing the original finite value, declared range, and clamped completion percent.

This preserves out-of-range information for TalkBack without producing an invalid native progress-bar state.

Progress nodes are noninteractive. They cannot invoke actions, receive callbacks, or contain child nodes.

## Persistence and lifecycle

Progress nodes are rendered output only. They do not add:

- SQLite tables or columns;
- runtime operations or effects;
- backup-format changes;
- restore behavior;
- Android permissions or services;
- background execution;
- removal cleanup.

A progress node is recalculated whenever the owning screen renders from the current validated runtime snapshot.

## Automated validation

Run from the repository root:

```powershell
pnpm format
pnpm check
```

Regenerate Android and run the connected suite because the embedded native SDK and runner source change:

```powershell
pnpm --dir apps/mobile exec expo prebuild `
  --platform android `
  --clean `
  --no-install

Set-Location apps/mobile/android
.\gradlew.bat :app:assembleDebug connectedDebugAndroidTest --max-workers=4
```

Coverage includes:

- default and explicit ranges;
- number and percent formats;
- nonzero minimum percent calculations;
- visual clamping above and below the range;
- preservation of original out-of-range values;
- finite-value and ordered-bound validation;
- invalid labels, formats, and custom styling;
- nested layout rendering;
- normal-protocol rejection and dormant-protocol preservation;
- embedded QuickJS builder exposure and page restoration;
- SDK 1.0 and SDK 1.1 rejection and regression behavior.

## Galaxy S24 Ultra acceptance

Use a temporary diagnostics-only fixture without enabling public SDK 1.2 authoring.

Verify on the Galaxy S24 Ultra:

1. Default 0-to-100 progress renders at the expected fill.
2. A nonzero range such as 10 to 30 calculates percent through the range correctly.
3. Number and percent labels are readable and align with the bar.
4. Values below the minimum display an empty bar without layout errors.
5. Values above the maximum display a full bar without overflow or clipping.
6. Long labels wrap or shrink without clipping the value or track.
7. Progress remains usable at increased Android font size.
8. Progress is noninteractive and does not create unintended touch targets.
9. TalkBack identifies the node as progress and reads the label when present.
10. TalkBack reads the original value, declared range, and completion percent, including for out-of-range values.
11. Navigation, background/foreground, force-stop, and relaunch preserve normal rendering.
12. Existing SDK 1.0 and SDK 1.1 tools render unchanged.

Remove any temporary acceptance fixture before merging the dormant implementation branch.
