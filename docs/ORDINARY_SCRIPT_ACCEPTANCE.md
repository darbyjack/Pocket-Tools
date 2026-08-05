# Release and Ordinary Tool Acceptance

This is the maintained release procedure for Pocket Tools and the public SDK 1.2 contract. Record run-specific evidence in the pull request or release record, not in this document.

## Acceptance sources

Use:

- [`fixtures/sdk12-agent-proof.miniapp.js`](fixtures/sdk12-agent-proof.miniapp.js) for SDK 1.2
- [`../examples/bathroom-pay.miniapp.js`](../examples/bathroom-pay.miniapp.js) for SDK 1.1 compatibility
- [`../examples/tip-splitter.miniapp.js`](../examples/tip-splitter.miniapp.js) for SDK 1.0 compatibility

The SDK 1.2 fixture must remain authorable from only:

- [`AGENT_AUTHORING.md`](AGENT_AUTHORING.md)
- [`AGENT_PROMPT.md`](AGENT_PROMPT.md)
- [`../packages/sdk-contract/dist/`](../packages/sdk-contract/dist/)

No source may rely on internal helper names, undocumented APIs, or tool-specific host behavior.

## 1. Repository checks

From the repository root:

```bash
corepack enable
pnpm install
pnpm sync:mini-apps:check
pnpm sdk:declarations:check
pnpm format
pnpm check
```

Review the diff after formatting. Generated declarations and the bundled example catalog must have no unexplained drift.

Validate and inspect all acceptance sources:

```bash
pnpm validate:mini-app ./docs/fixtures/sdk12-agent-proof.miniapp.js
pnpm inspect:mini-app ./docs/fixtures/sdk12-agent-proof.miniapp.js
pnpm validate:mini-app ./examples/bathroom-pay.miniapp.js
pnpm inspect:mini-app ./examples/bathroom-pay.miniapp.js
pnpm validate:mini-app ./examples/tip-splitter.miniapp.js
pnpm inspect:mini-app ./examples/tip-splitter.miniapp.js
```

## 2. Contract and compatibility matrix

Automated validation must prove:

- SDK 1.0 and 1.1 definitions and behavior remain valid.
- Every SDK 1.2 definition, UI node, operation, effect, and notification shape requires a 1.2 manifest.
- Unknown keys, unsupported enum values, unsafe objects, non-finite values, malformed dates, invalid multi-select arrays, invalid queries, excessive effects, invalid notification targets, and malformed native responses fail closed.
- One failed action rolls back setting, record, timer, and notification-registry mutations and performs no effects.
- A valid invocation succeeds immediately after a failed invocation.
- The authoring guide template matches its executable fixture.
- generated declarations match source.

## 3. Clean Android build and connected tests

With a compatible ARM64 Android device connected:

```bash
pnpm --dir apps/mobile exec expo prebuild --platform android --clean --no-install
cd apps/mobile/android
./gradlew :app:assembleDebug connectedDebugAndroidTest --max-workers=4
```

Record the device, Android version, commit, build result, and instrumentation test counts. Separate dependency or packaging warnings from failures.

## 4. Ordinary installation path

For each acceptance source:

1. copy the exact source
2. choose **Add tool**
3. paste and choose **Check**
4. preview and confirm first render
5. install through the ordinary editor
6. confirm no host rebuild or tool-specific code is required

The SDK 1.2 fixture should exercise representative date/date-time, multi-select, setting writes, records, queries, aggregates, rows, badges, progress, icons, feedback, copy/share, and notifications.

## 5. State and transaction behavior

Verify:

- native setting controls persist validated values
- canonical dates and UTC date-times survive relaunch
- multi-select values remain ordered, unique, and bounded
- queries and `count`, `sum`, `min`, `max`, and `average` return expected values
- same-action reads observe prior successful writes
- an intentionally invalid later operation rolls back the complete action
- no feedback or output occurs after a failed action
- the next valid action succeeds

Do not install an intentionally invalid candidate.

## 6. UI, output, and accessibility

Verify:

- tappable row and visible-action taps are isolated
- destructive actions use host confirmation
- badges, progress, and fixed icons render consistently
- labels remain authoritative for TalkBack
- multiline and numeric controls remain usable at large font sizes
- copy writes only requested text
- share opens the Android share sheet
- canceling share does not undo committed state
- no script can read clipboard contents or observe share completion

## 7. Notifications

Verify:

- permission denial and disabled channel retain blocked desired schedules
- foreground/startup reconciliation recovers when delivery becomes available
- replacing the same stable ID creates one desired schedule
- standard immediate or scheduled delivery posts once
- tapping opens the declared installed screen without invoking an action
- cancellation removes desired and derived state
- missing exact-alarm access fails before durable mutation
- restored exact schedules remain exact and blocked until access is granted
- force-stop, relaunch, clock/timezone recovery, update, restore, and removal reconcile without duplication
- a paired watch may mirror the phone notification according to Android/Galaxy Wearable settings; Pocket Tools exposes no watch API

## 8. Lifecycle

Verify:

- valid update preserves state and creates rollback source
- invalid update leaves active and rollback source unchanged
- rollback preserves settings, records, timers, and desired notifications
- duplicate requires a new manifest ID and copies no state
- script export contains the active source
- tool backup/restore preserves both sources and complete portable state
- complete-host backup/restore replaces all user-owned state atomically
- removal always clears notifications
- retain-data removal restores ordinary state on reinstall
- delete-data removal starts clean

## 9. Process-death diagnostics

Run both procedures in [Lifecycle and Namespace Diagnostics](LIFECYCLE_DIAGNOSTICS.md). Confirm `adb shell pidof com.darbyjack.pockettools` prints no PID before reopening the app.

## Evidence record

Record:

- date and commit
- device and Android version
- repository command results
- declaration and bundled-catalog drift result
- validation and inspection results
- Android build and test counts
- SDK 1.0/1.1 compatibility result
- SDK 1.2 ordinary workflow result
- transaction rollback result
- accessibility and output result
- notification permission, exact-access, routing, and recovery result
- lifecycle, backup, removal, and force-stop result
- unexpected warnings or defects

A release is accepted only when every applicable item passes or an identified defect is fixed and retested.
