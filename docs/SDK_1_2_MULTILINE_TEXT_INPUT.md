# SDK 1.2 Multiline Text Input

## Status

This slice implements the dormant SDK 1.2 multiline text-input path. SDK 1.2 remains unsupported for ordinary authoring, preview, installation, and updates until the later activation slice.

This implementation does not change:

- `SDK_VERSION`
- `SUPPORTED_SDK_VERSIONS`
- public TypeScript declarations
- starter templates or bundled tools
- normal source acceptance

SDK 1.0 and 1.1 text inputs retain their existing single-line behavior.

## Frozen contract

Multiline presentation belongs to the text input node rather than the stored text setting:

```js
ui.textInput({
  setting: "notes",
  label: "Notes",
  placeholder: "Add notes",
  multiline: true,
  minLines: 4,
});
```

The bound setting remains an ordinary text setting:

```js
setting.text({
  label: "Notes",
  default: "",
  maxLength: 10_000,
});
```

`multiline` and `minLines` are SDK 1.2-only UI properties. `minLines` is optional, accepts an integer from 2 through 8, and requires `multiline: true`. Omitting `minLines` uses four visible lines.

## Validation boundaries

The dormant path validates the same shape independently at both trust boundaries:

1. The embedded QuickJS wrapper rejects multiline properties below SDK 1.2, rejects malformed values, strips the new fields before the frozen legacy runner validates the rest of the UI tree, and restores them only after a successful render.
2. The trusted host protocol repeats SDK gating and malformed-shape validation before React Native receives the page.
3. Existing text-setting binding validation still requires a declared text setting and rejects unknown UI properties.

The public parser continues rejecting the dormant fields. Only the explicitly dormant SDK 1.2 parser accepts them.

## Host rendering

React Native owns the complete input control. Scripts cannot select a keyboard, style, native component, editor mode, or text format.

The host renders multiline text with:

- the existing Pocket Tools theme tokens
- four visible lines by default or the validated `minLines` value
- a fixed height derived from 2 through 8 lines
- top-aligned Android text
- native internal scrolling for content beyond the visible area
- the existing accessible setting label plus a multiline editing hint
- newline insertion instead of single-line submit behavior
- commit on blur through the existing validated setting-write path

The installed-tool screen is keyboard-aware, keeps taps handled while the keyboard is open, and enables nested Android scrolling. The input height never grows with content, so long values cannot expand the surrounding layout without bound.

## Persistence and lifecycle behavior

Multiline is presentation metadata only. Stored values remain ordinary strings and continue through the same setting validation and SQLite write path. No backup schema, restore schema, installation record, preview namespace, update transaction, rollback source, or action operation changes are required.

As a result, the existing behavior remains authoritative for:

- minimum and maximum text length
- setting defaults and visibility
- host setting persistence
- transactional SDK 1.2 setting operations
- preview, install, update, and rollback isolation
- single-tool and complete-host backup and restore

## Automated coverage

The repository tests cover:

- valid SDK 1.2 multiline and `minLines` shapes
- public-parser rejection while activation remains disabled
- SDK 1.0 and 1.1 rejection of both new properties
- unchanged ordinary SDK 1.0 and 1.1 text inputs
- non-boolean `multiline`
- `minLines` without `multiline: true`
- fractional and out-of-range line counts
- incompatible setting bindings and unknown properties
- bounded host input dimensions
- embedded Android QuickJS rendering and malformed-input gating

## Required physical Android acceptance

Run this checklist on the Galaxy S24 Ultra before moving the implementation PR out of draft:

1. Open a dormant acceptance build containing a text setting rendered with `multiline: true` and `minLines: 4`.
2. Confirm the control initially displays four lines and does not grow as more lines are entered.
3. Enter paragraphs containing newlines, punctuation, emoji, combining characters, and text near the setting maximum.
4. Confirm Enter inserts a newline rather than committing or dismissing the keyboard.
5. Scroll inside the text control to the beginning and end of a long value.
6. Scroll the surrounding tool screen while the multiline control contains enough text to scroll internally.
7. Confirm the focused control remains reachable above the Android keyboard and that dragging dismisses the keyboard normally.
8. Move focus away, reopen the tool, and confirm the exact text persists.
9. Exercise preview, install, update, rollback, single-tool backup/restore, and complete backup/restore with the multiline value.
10. Enable TalkBack and confirm the setting label and multiline editing hint are announced without duplicate developer-facing text.
11. Recheck an SDK 1.0 and an SDK 1.1 tool containing ordinary text inputs and confirm their editing behavior is unchanged.

## Repository and Android validation

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

Keep the PR in draft until every command and the physical acceptance checklist pass.
