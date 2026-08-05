# SDK 1.2 Host-Owned Copy and Share Output

## Status

This capability is public in SDK 1.2 and is available through ordinary authoring, validation, inspection, preview, installation, execution, update, rollback, export, backup/restore, and removal paths where applicable.

- `SDK_VERSION` is `"1.2"`.
- Supported manifest versions are `"1.0"`, `"1.1"`, and `"1.2"`.
- The public SDK source, generated declarations, local authoring runtime, embedded QuickJS runtime, host validators, and Android UI/lifecycle paths expose this capability.

Internal source, test, or helper names created during staged implementation may retain `sdk12` or `dormant` compatibility wording. Those names do not gate or expand the public API.

## Runtime client

Dormant SDK 1.2 actions receive:

```js
context.output.copy("Copied value");

context.output.share({
  title: "Pocket Tools",
  text: "Shared value",
});
```

The embedded runtime records one of these effects:

```json
{
  "type": "copy",
  "text": "Copied value"
}
```

```json
{
  "type": "share",
  "title": "Pocket Tools",
  "text": "Shared value"
}
```

Rules:

- output is available only in SDK 1.2 action execution
- one action may request at most one output effect, either copy or share
- a second output request fails the complete action
- output text must contain 1 to 10,000 Unicode code points
- an optional share title must contain 1 to 120 Unicode code points
- share requests accept only `text` and optional `title`
- render contexts reject output
- SDK 1.0 and 1.1 contexts do not receive an output client
- actions that fail after requesting output return no effect
- successful actions that request no output omit the output effect

Scripts cannot read the clipboard, select MIME types, attach files, provide file paths, receive incoming shares, inspect share results, or launch arbitrary Android intents.

## Runtime layering

Output shares the existing SDK 1.2 effect wrapper with host-owned feedback.

For SDK 1.2 definitions it:

1. preserves the existing context and all earlier SDK 1.2 clients
2. adds frozen `feedback` and `output` clients to wrapped contexts
3. rejects feedback and output calls outside action execution
4. validates and records invocation-local effects
5. invokes the established runtime chain
6. appends effects only when the established runner returns a successful action response

An action may return at most two effects in total: one output effect and one feedback effect. Their serialized call order is retained, while the host always performs output before displaying feedback.

Definitions below SDK 1.2 and malformed definitions pass through unchanged so established validation remains authoritative.

## Trusted response parsing

Normal response parsing continues to reject any `effects` member. Only the explicit dormant SDK 1.2 parser accepts effects.

The trusted parser requires:

- an array with no more than two entries
- no more than one output effect
- no more than one feedback effect
- exact keys for copy, share, and feedback shapes
- the same Unicode bounds enforced by QuickJS
- no unsupported effect types or script-selected output options

This validation occurs before any durable operation is applied.

## Delivery order

The host action pipeline performs this exact sequence:

1. execute and validate the complete action response
2. apply durable operations
3. commit or roll back storage
4. rerender from committed state
5. perform the output effect, when present
6. expose the feedback message, when present

If operation application or rerender fails, no clipboard or share operation occurs. A clipboard or Android share failure occurs after commit and therefore cannot roll back durable state; it is surfaced through the existing host-owned action error path.

## Android host

Copy uses Expo Clipboard's write-only `setStringAsync` API. Pocket Tools does not expose any clipboard read method to scripts.

Share uses React Native's host-owned share sheet with plain text and an optional title. Scripts do not receive native callbacks or the selected destination.

## Coverage

TypeScript tests cover:

- exact dormant copy and share parsing
- copy/share alongside feedback
- normal-parser activation rejection
- Unicode text and title boundaries
- malformed, duplicated, unsupported, and overlong effects
- commit-before-rerender-before-output-before-feedback ordering
- suppression when operation application fails
- suppression when rerender fails
- post-commit output failure behavior

Connected Android instrumentation covers:

- copy alongside a durable setting operation and feedback
- share with optional title
- maximum Unicode output length
- malformed and repeated output rejection
- action failure after output request
- render-context rejection
- SDK 1.1 non-exposure

## Required local validation

```powershell
pnpm install --lockfile-only
pnpm format
pnpm check

pnpm --dir apps/mobile exec expo prebuild `
  --platform android `
  --clean `
  --no-install

Set-Location apps/mobile/android
.\gradlew.bat :app:assembleDebug connectedDebugAndroidTest
```

Physical acceptance on Android must confirm that copy writes the expected plain text and share opens the host sheet with the expected text and optional title.

## Deferred to activation

The final SDK 1.2 activation slice will publish `OutputClient`, output effect types, generated declarations, authoring documentation, templates, and ordinary installed-script support after every frozen SDK 1.2 capability is complete.
