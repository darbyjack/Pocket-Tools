# SDK 1.2 Host-Owned Feedback

## Status

This capability is public in SDK 1.2 and is available through ordinary authoring, validation, inspection, preview, installation, execution, update, rollback, export, backup/restore, and removal paths where applicable.

- `SDK_VERSION` is `"1.2"`.
- Supported manifest versions are `"1.0"`, `"1.1"`, and `"1.2"`.
- The public SDK source, generated declarations, local authoring runtime, embedded QuickJS runtime, host validators, and Android UI/lifecycle paths expose this capability.

Internal source, test, or helper names created during staged implementation may retain `sdk12` or `dormant` compatibility wording. Those names do not gate or expand the public API.

## Runtime effect

Dormant SDK 1.2 actions receive:

```js
context.feedback.show("Saved");
```

The embedded runtime records one exact effect:

```json
{
  "type": "feedback",
  "message": "Saved"
}
```

Rules:

- feedback is available only in SDK 1.2 action execution
- the message must be a string containing 1 to 160 Unicode code points
- one action may request feedback at most once
- a second request fails the complete action
- render contexts reject feedback
- SDK 1.0 and 1.1 contexts do not receive a feedback client
- actions that fail after requesting feedback return no effect
- successful actions that request no feedback omit the `effects` member

Scripts cannot select presentation, duration, position, colors, icons, markup, callbacks, or accessibility behavior.

## Runtime layering

The feedback runner wraps the previously merged everyday-query runner rather than replacing it.

For SDK 1.2 definitions it:

1. preserves the existing context and all earlier SDK 1.2 clients
2. adds a frozen feedback client to wrapped screen and action contexts
3. rejects feedback calls outside action execution
4. records feedback in invocation-local state
5. invokes the established runner
6. appends the effect only when the established runner returns a successful action response

Definitions below SDK 1.2 and malformed definitions pass through unchanged so established validation behavior remains authoritative.

## Trusted response parsing

The host model adds an optional `RuntimeValue.effects` list and one dormant `FeedbackEffect` type.

Normal response parsing rejects any `effects` member. Only the explicit dormant SDK 1.2 parser accepts it.

The trusted parser requires:

- an array
- no more than one effect in this slice
- exact `type` and `message` keys
- `type: "feedback"`
- a string message containing 1 to 160 Unicode code points

This validation occurs before any durable operation is applied.

## Delivery order

The host action pipeline performs feedback in this order:

1. execute the action
2. validate the full response
3. apply durable operations
4. rerender from committed storage
5. commit the new React Native screen
6. publish the pending feedback message

If operation application or rerender fails, no feedback message is returned to the presentation layer.

A source guard prevents an action from an old tool from replacing the current screen or publishing feedback after the user switches tools.

Feedback clears when:

- another action begins
- the user navigates to another tool screen
- a host-owned setting changes
- the script source or selected tool changes
- the user presses Dismiss
- runtime startup or action handling fails

## Host presentation

Pocket Tools presents feedback as an in-flow accessible success notice above the active tool screen.

The notice:

- uses Android polite live-region announcement
- includes a host-owned Dismiss button
- uses existing `colors`, `radii`, and `spacing` tokens only
- exposes no script-selected styling
- remains independent of the mini-app UI tree

No new style tokens or dependencies are introduced.

## Coverage

TypeScript tests cover:

- exact dormant effect parsing
- normal-parser activation rejection
- Unicode message length boundaries
- malformed, repeated, unsupported, and overlong effects
- commit-before-rerender-before-feedback ordering
- suppression when operation application fails
- suppression when rerender fails
- empty effect behavior

Connected Android instrumentation covers:

- feedback alongside a durable setting operation
- maximum Unicode message length
- empty, overlong, non-string, and repeated feedback rejection
- action failure after feedback request
- omission when no feedback is requested
- render-context rejection
- SDK 1.1 non-exposure

## Required local validation

```powershell
pnpm format
pnpm check

pnpm --dir apps/mobile exec expo prebuild `
  --platform android `
  --clean `
  --no-install

Set-Location apps/mobile/android
.\gradlew.bat :app:assembleDebug connectedDebugAndroidTest
```

The Android build must compile the feedback wrapper translation unit and all prior runtime layers. Connected instrumentation must pass the feedback suite and every existing QuickJS test.

## Deferred to activation

The final SDK 1.2 activation slice will publish `FeedbackClient`, `RuntimeEffect`, generated declarations, authoring documentation, templates, and normal installed-script support after every frozen SDK 1.2 capability is complete.
