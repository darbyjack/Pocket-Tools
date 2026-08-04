# SDK 1.2 Date and Date-Time Data

## Status

This is the second internal implementation slice of the frozen [SDK 1.2 contract](SDK_1_2_CONTRACT.md).

The slice implements date and date-time definitions, values, native controls, storage validation, and temporal query behavior, but it does **not** activate SDK 1.2:

- `SDK_VERSION` remains `"1.1"`.
- `SUPPORTED_SDK_VERSIONS` remains `"1.0"` and `"1.1"`.
- Public generated declarations do not expose the new builders or nodes.
- The canonical agent template and authoring guide remain on SDK 1.1.
- Ordinary inspection, preview, and installation still reject `sdkVersion: "1.2"`.

The dormant path is reachable only through explicit internal parsing and native instrumentation used to build the complete SDK 1.2 implementation safely before activation.

## Canonical values

Date-only values use exact `YYYY-MM-DD` strings.

Validation requires:

- four-digit years from `0001` through `9999`
- two-digit months and days
- real Gregorian calendar dates
- correct leap-year handling
- no timezone conversion

Date-time values use exact UTC strings in `YYYY-MM-DDTHH:mm:ss.sssZ` form.

Validation rejects:

- missing millisecond precision
- timezone-less timestamps
- numeric timezone offsets
- invalid or normalized-overflow dates
- years outside the supported four-digit range
- values outside declared bounds

Canonical strings compare lexicographically in chronological order.

## Dormant definition surface

The embedded SDK implements:

```js
setting.date({
  label: "Due date",
  default: "2026-08-03",
  min: "2026-01-01",
  max: "2026-12-31",
});

setting.datetime({
  label: "Reminder",
  default: "2026-08-04T03:30:00.000Z",
});

field.date({ min: "2026-01-01" });
field.datetime({ max: "2026-12-31T23:59:59.999Z" });
```

Date and date-time settings require a default. Optional minimum and maximum values must use the same canonical representation, must be ordered, and must contain the default.

The existing `field.datetime(...)` remains unchanged for SDK 1.0 and 1.1. Only dormant SDK 1.2 definitions receive canonical UTC enforcement and optional bounds.

The trusted host normalizes validated temporal definitions with an internal `hostSdkVersion: "1.2"` marker. The marker is not part of source, inspection JSON, generated declarations, backup data, or the public SDK contract. It prevents dormant SDK 1.2 date-time values from being confused with legacy date-time definitions inside shared storage validators.

## Native Android controls

The renderer implements:

```js
ui.dateInput({ setting: "dueDate" });
ui.datetimeInput({ setting: "reminderAt" });
```

Both controls are host-owned and bind only to a compatible declared setting.

Pocket Tools uses the SDK 57 `@expo/ui` DateTimePicker replacement in Android dialog mode:

- date-only values are converted to and from local calendar components without passing through UTC
- date-time values display in the device timezone
- confirmed date-time selections are normalized to UTC with zero seconds and milliseconds
- minimum and maximum values are passed to the native picker
- canceling or dismissing the dialog changes no setting
- confirming uses the same host setting update and schema-validation path as every other setting control

Scripts receive no native picker object, callback, locale setting, timezone override, style, or dialog handle.

## Trusted validation and persistence

The embedded runner validates temporal values before recording setting or record operations.

The React Native host independently validates:

- dormant definition shapes and exact keys
- canonical defaults and bounds
- date/date-time UI node shape and compatible setting binding
- setting values loaded from or written to SQLite
- collection values inserted, updated, restored, or loaded

The existing `settings`, `records`, backup, restore, preview, and transaction storage paths remain in use. No date-specific table or parallel persistence mechanism is added.

Action-driven `settings.set(...)` and `settings.reset(...)` from the previous slice accept temporal values through the same ordered SQLite transaction as records and timers.

## Query behavior

Dormant SDK 1.2 date and date-time fields support:

- `eq`
- `neq`
- `gt`
- `gte`
- `lt`
- `lte`

Canonical string comparison supplies chronological ordering for filters and `orderBy`.

This slice does not expand other field types. Text, boolean, number, and money query behavior remains unchanged until the dedicated everyday-query slice.

## Compatibility boundary

SDK 1.0 and 1.1 retain their existing behavior:

- they cannot declare date settings or date fields
- they cannot render date or date-time input nodes
- their existing unbounded `field.datetime(...)` values continue accepting ISO-compatible parseable timestamps
- their public declarations, inspection, rendering, storage, backup, and authoring behavior are unchanged

Normal host parsing rejects both 1.2 manifests and temporal UI nodes. Separate explicit dormant parser functions are used only by internal tests while implementation is incomplete.

## Coverage

Automated coverage includes:

- Gregorian date and leap-year validation
- canonical UTC date-time validation
- local date-only round trips
- dormant inspection normalization and activation-guard rejection
- temporal definition exact keys, defaults, and bounds
- date/date-time UI binding and unknown-property rejection
- trusted setting and record validation
- legacy date-time compatibility
- embedded SDK builders
- action-driven temporal setting writes
- invalid, offset, and out-of-range value rejection
- chronological `neq`, `gt`, and `lt` queries
- native QuickJS inspection and render output

## Required local validation

The branch adds `@expo/ui` to `apps/mobile/package.json`. Regenerate and commit the lockfile locally before merge:

```powershell
pnpm install
pnpm format
pnpm check

pnpm --dir apps/mobile exec expo prebuild --platform android --clean --no-install
Set-Location apps/mobile/android
.\gradlew.bat :app:assembleDebug connectedDebugAndroidTest
```

Physical Android acceptance must also verify:

1. Open and cancel both pickers; no setting changes.
2. Confirm a date and verify the same calendar date persists after relaunch.
3. Confirm a date-time and verify local display plus canonical UTC persistence.
4. Verify declared minimum and maximum values constrain selection.
5. Verify existing SDK 1.0 and 1.1 tools still render and edit settings normally.

## Deferred to activation

The final SDK 1.2 activation slice will publish the new TypeScript definitions, generated declarations, authoring documentation, templates, and normal installed-script support after every frozen SDK 1.2 capability is complete.
