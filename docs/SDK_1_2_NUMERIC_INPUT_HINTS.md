# SDK 1.2 numeric input hints

## Status

This capability is public in SDK 1.2 and is available through ordinary authoring, validation, inspection, preview, installation, execution, update, rollback, export, backup/restore, and removal paths where applicable.

- `SDK_VERSION` is `"1.2"`.
- Supported manifest versions are `"1.0"`, `"1.1"`, and `"1.2"`.
- The public SDK source, generated declarations, local authoring runtime, embedded QuickJS runtime, host validators, and Android UI/lifecycle paths expose this capability.

Internal source, test, or helper names created during staged implementation may retain `sdk12` or `dormant` compatibility wording. Those names do not gate or expand the public API.

## Frozen contract

```ts
interface NumberInputNode extends SettingInputNode<"number-input"> {
  readonly step?: number;
  readonly decimalPlaces?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
}
```

Example:

```js
ui.numberInput({
  setting: "amount",
  label: "Amount",
  step: 0.01,
  decimalPlaces: 2,
});
```

`number-input` remains bound to an existing `number` or `money` setting.

## Validation

- `step` is optional.
- When present, `step` must be a finite number greater than zero.
- `decimalPlaces` is optional.
- When present, `decimalPlaces` must be an integer from 0 through 6.
- The two hints are accepted only by the explicit dormant SDK 1.2 validation path.
- SDK 1.0 and SDK 1.1 reject either property, including otherwise harmless values such as `decimalPlaces: 0`.
- Unknown properties continue failing exact-key validation.
- Text, boolean, select, date, and date-time settings cannot be bound to `number-input`.

The embedded QuickJS layer validates and temporarily removes the dormant properties before the established UI validator runs, then restores the exact validated properties onto the successful render result. This preserves the existing UI depth, node-count, circular-reference, exact-key, setting-binding, and bridge-complexity protections.

## Host-owned editing behavior

Pocket Tools owns all native input behavior.

### Decimal precision

When `decimalPlaces` is present:

- the native field displays the committed value with exactly that many fractional digits;
- a newly typed value is rounded to that precision when editing commits through blur or keyboard submission;
- positive and negative half-values use symmetric rounding;
- negative zero is displayed and stored as zero;
- `decimalPlaces: 0` uses the numeric keyboard hint and commits whole-number edits.

An empty, malformed, or non-finite draft is not persisted. The field returns to the last trusted setting value.

### Step controls

When `step` is present, Pocket Tools renders host-owned decrease and increase controls beside the native input.

- Each press changes the currently visible valid value by exactly one declared step.
- Decimal stepping uses bounded precision handling to avoid values such as `0.30000000000000004` appearing in the field.
- The setting's declared minimum and maximum still clamp the committed result.
- Accessible control labels include the setting label, direction, and step amount.
- Scripts cannot choose button style, placement, icons, gesture behavior, repeat rate, or native component implementation.

`step` is an editing hint, not a schema rule. A user may type a valid value that is not an exact multiple of the step. The host does not silently snap arbitrary typed values to a step grid.

## Preserved semantics

Numeric hints do not change:

- number or money setting definitions;
- setting defaults, minimums, or maximums;
- transactional `settings.set(...)` and `settings.reset(...)` behavior;
- collection field validation;
- arithmetic inside the mini app;
- query comparison behavior;
- aggregate behavior;
- SQLite representation;
- portable or complete-host backup formats;
- preview isolation;
- installation, update, rollback, duplication, removal, or retained-state behavior.

Only a value newly committed through this host input can be rounded by `decimalPlaces` or adjusted through the host-owned step controls. The final finite value still passes through the existing trusted setting validation and persistence path.

## Automated coverage

The dormant slice includes coverage for:

- trusted SDK 1.2 acceptance and normal-parser rejection;
- SDK 1.0 and SDK 1.1 rejection of both new properties;
- positive, zero, negative, non-finite, and non-number `step` values;
- integer and non-integer `decimalPlaces` boundaries;
- exact response-shape preservation;
- number and money setting binding;
- unknown UI properties;
- fixed-decimal display and symmetric rounding;
- invalid-draft rollback;
- schema minimum and maximum clamping;
- decimal step arithmetic without floating-point display noise;
- embedded Android QuickJS rendering and lower-version compatibility.

## Repository and Android validation

From the repository root on Windows:

```powershell
pnpm format
pnpm check

pnpm --dir apps/mobile exec expo prebuild `
  --platform android `
  --clean `
  --no-install

Set-Location apps/mobile/android
.\gradlew.bat :app:assembleDebug connectedDebugAndroidTest --max-workers=4
```

The implementation PR remains draft until these commands and the physical-device procedure pass.

## Galaxy S24 Ultra physical acceptance

Use a temporary local acceptance fixture or debug-only harness that reaches the dormant SDK 1.2 render path. Remove that fixture or harness before the PR becomes ready for review.

Verify on the Galaxy S24 Ultra:

1. Open an ordinary SDK 1.0 or SDK 1.1 number input and confirm its appearance, keyboard, commit, persistence, and rerender behavior are unchanged.
2. Open a dormant SDK 1.2 number input with no hints and confirm it behaves like the legacy control.
3. Open an input with `decimalPlaces: 0`; enter positive and negative fractional values and confirm committed display is a whole number with symmetric rounding.
4. Open an input with `decimalPlaces: 2`; enter `1.235` and `-1.235` and confirm the committed values display as `1.24` and `-1.24`.
5. Open an input with `decimalPlaces: 6` and confirm six fractional digits remain visible without layout clipping.
6. Clear the field, enter only a sign or decimal separator, and enter malformed text where the keyboard permits; confirm no invalid value persists and the trusted value returns.
7. Confirm values below the declared minimum and above the declared maximum commit at the existing schema bounds.
8. Use `step: 0.01` repeatedly across values such as `0.20`, `0.29`, and `0.30`; confirm no floating-point artifact appears.
9. Use a whole-number `step: 1` with `decimalPlaces: 0` and verify both directions.
10. Type a schema-valid value that is not a multiple of the step and confirm it remains valid rather than being silently snapped.
11. Confirm the software keyboard, outer tool scrolling, focus, blur, and keyboard dismissal keep all controls reachable.
12. Confirm edits and step presses rerender the active screen and persist after navigating away, returning, force-stopping, and relaunching.
13. Confirm preview isolation, install/update state, rollback, portable backup restore, and complete-host backup restore retain the same numeric values as before this slice.
14. Enable TalkBack and confirm the field label, numeric editing hint, decrease label, increase label, focus order, selected value, and touch targets are understandable and independently reachable.
15. Re-run one existing SDK 1.0 tool and one SDK 1.1 tool as a final compatibility check.

## Activation boundary

This slice does not update:

- `SDK_VERSION`;
- `SUPPORTED_SDK_VERSIONS`;
- public SDK TypeScript sources;
- generated declaration files;
- the canonical agent-authoring template;
- bundled examples;
- ordinary SDK 1.2 validation or installation acceptance;
- GitHub Actions workflows.

Public activation remains a separate final SDK 1.2 decision after all frozen capabilities and compatibility gates are complete.
