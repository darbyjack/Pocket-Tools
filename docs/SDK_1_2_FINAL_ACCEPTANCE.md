# SDK 1.2 Final Acceptance

This procedure is the final release gate for Pocket Tools SDK 1.2. It proves that the complete public contract works through the same authoring, validation, installation, persistence, lifecycle, notification, accessibility, and recovery paths available to an ordinary tool.

Tracker: [#68](https://github.com/darbyjack/Pocket-Tools/issues/68)

## Acceptance source

Use [`fixtures/sdk12-agent-proof.miniapp.js`](fixtures/sdk12-agent-proof.miniapp.js).

The proof source was authored from only:

- [`AGENT_AUTHORING.md`](AGENT_AUTHORING.md)
- [`AGENT_PROMPT.md`](AGENT_PROMPT.md)
- [`../packages/sdk-contract/dist/`](../packages/sdk-contract/dist/)

It must not rely on host source, internal helper names, undocumented APIs, or a mini-app-specific host branch.

The tool intentionally exercises representative public SDK 1.2 behavior:

- Text, money, date, date-time, and bounded multi-select settings
- Multiline text and numeric input hints
- Transactional setting reset/set plus collection insertion
- Date/date-time/text/boolean/money collection fields
- Query filtering, ordering, count, sum, min, max, and average
- Badge, progress, summary, fixed icons, primary row actions, and visible actions
- Host confirmation and event-propagation isolation
- Feedback, copy, and Android share output
- Standard daily notification scheduling, cancellation, reconciliation, and tap routing

## 1. Repository and declaration validation

From the repository root:

```powershell
corepack enable
pnpm install
pnpm sdk:declarations
pnpm sync:mini-apps
pnpm format
pnpm check
```

The generated declarations and bundled catalog must produce no uncommitted drift after the commands complete.

Validate and inspect the proof source directly:

```powershell
pnpm validate:mini-app .\docs\fixtures\sdk12-agent-proof.miniapp.js
pnpm inspect:mini-app .\docs\fixtures\sdk12-agent-proof.miniapp.js

pnpm mini-app validate .\docs\fixtures\sdk12-agent-proof.miniapp.js --json
pnpm mini-app inspect .\docs\fixtures\sdk12-agent-proof.miniapp.js --json
```

Inspection must report:

- Manifest ID `sdk12-acceptance`
- Manifest version `1.2`
- Settings `title`, `notes`, `amount`, `dueDate`, `reminderAt`, and `tags`
- Collection `tasks`
- Screen `home`
- Actions `saveTask`, `toggleTask`, `copyTask`, `deleteTask`, `shareSummary`, and `cancelReminder`

## 2. SDK compatibility and malformed-input matrix

Automated validation must prove:

- Existing SDK 1.0 definitions, UI, operations, lifecycle diagnostics, and bundled scripts remain valid.
- Existing SDK 1.1 action controls, disabled state, destructive intent, confirmation, and visible list actions remain valid.
- Every public SDK 1.2 definition, node, operation, effect, context client, and notification shape is accepted only under a 1.2 manifest.
- 1.2-only fields under 1.0 or 1.1 fail with stable version-aware validation.
- Unknown keys, unsupported enum values, non-finite values, unsafe objects, invalid targets, malformed dates, invalid multi-select arrays, invalid queries, excessive effects, invalid notification IDs/triggers, and malformed native responses fail closed.
- An action failure rolls back setting, record, timer, and notification-registry mutations and performs no output or feedback effect.
- A valid invocation succeeds immediately after a failed invocation.

## 3. Clean Android build and connected tests

With the Galaxy S24 Ultra connected:

```powershell
pnpm --dir apps/mobile exec expo prebuild `
  --platform android `
  --clean `
  --no-install

Set-Location apps/mobile/android
.\gradlew.bat :app:assembleDebug connectedDebugAndroidTest --max-workers=4
```

Record the exact test counts for:

- Expo JSON instrumentation
- Pocket Tools notification instrumentation
- Pocket Tools QuickJS instrumentation

Warnings from dependencies or Android packaging must be distinguished from actual test/build failures.

## 4. Ordinary authoring, preview, and installation

1. Copy the exact proof source:

   ```powershell
   Get-Content -Raw .\docs\fixtures\sdk12-agent-proof.miniapp.js | Set-Clipboard
   ```

2. Open Pocket Tools and choose **Add tool**.
3. Paste the source.
4. Choose **Check** and confirm SDK 1.2 inspection succeeds.
5. Choose **Preview** and confirm the first render passes.
6. Confirm preview storage is isolated from any existing installed tool.
7. Choose **Install tool**.
8. Confirm **SDK 1.2 Acceptance** opens through the ordinary installed-tool runner.

No host rebuild or mini-app-specific code change is permitted after the source is copied.

## 5. Settings, UI, data, and transaction behavior

### Settings and native controls

1. Enter a recognizable task title.
2. Enter multiple lines of notes and confirm the input remains usable at large Android font size.
3. Enter a decimal amount and confirm the numeric keyboard/hints do not bypass final validation.
4. Choose a date.
5. Choose a date and time; confirm the host displays local time and persists a canonical UTC instant.
6. Select multiple tags and confirm selection order follows declaration order.

### Save action

1. Tap **Save task and schedule daily review**.
2. Confirm one task is inserted.
3. Confirm the title resets to its declared default.
4. Confirm notes are set to an empty string.
5. Confirm the copy effect writes `Task saved through SDK 1.2`.
6. Confirm feedback appears only after the task and settings changes are durable.
7. Confirm a desired `dailyReview` notification appears in the tool's notification settings.

### Queries and aggregates

1. Save at least three tasks with different amounts and completion states.
2. Confirm total, minimum, maximum, average, completed count, and title-contains count update correctly.
3. Confirm the list is ordered by creation time and open-task calculations use the declared filters.
4. Force-stop and reopen the app; confirm the same records, settings, aggregates, and desired reminder return.

### Host-owned UI and actions

1. Confirm badge tone and progress update with completion state.
2. Confirm all fixed icons are visually consistent and are not announced separately by TalkBack.
3. Tap a task row and confirm only the primary toggle action runs once.
4. Tap **Copy task title** and confirm only the visible copy action runs once.
5. Cancel the delete confirmation and confirm no record is removed.
6. Confirm deletion and verify exactly one record is removed.
7. Confirm long labels, large fonts, and TalkBack remain usable without clipping or duplicate announcements.

### Transaction rollback

Create a temporary source edit that performs one valid setting or record write followed by an intentionally invalid operation in the same action. Preview the candidate only.

Confirm:

- The action reports a stable error.
- No earlier setting, record, timer, or notification mutation persists.
- No feedback, copy, or share effect occurs.
- The next valid action succeeds normally.

Do not install the intentionally invalid candidate.

## 6. Feedback, copy, and sharing

1. Save a task and confirm feedback plus copy occur after commit.
2. Tap **Copy task title** and confirm the clipboard contains only the selected title.
3. Tap **Share summary** and confirm the Android share sheet opens with the expected title/text.
4. Cancel the share sheet and confirm tool state remains committed and unchanged.
5. Confirm no script can read clipboard contents or observe the share result.

## 7. Notification permission, scheduling, and routing

### Permission and channel

1. Open **Settings → Notifications**.
2. Record notification permission, reminders-channel, and exact-alarm access state.
3. Deny or disable ordinary notification delivery.
4. Confirm the desired daily reminder remains stored as blocked.
5. Re-enable delivery, return to Pocket Tools, and confirm foreground reconciliation schedules it without duplication.

### Standard delivery and cancellation

1. Adjust a temporary proof-source copy to schedule an immediate standard notification, preview/install the valid update, and confirm one notification posts.
2. Tap it and confirm Pocket Tools opens `sdk12-acceptance` on `home` without invoking an action.
3. Confirm daily replacement under the same `dailyReview` ID creates only one desired schedule.
4. Tap **Cancel daily review**, cancel the confirmation once, and confirm the reminder remains.
5. Confirm cancellation and verify the desired schedule and Android alarm are removed.

### Exact access

Use a temporary valid source update with a future exact date trigger.

1. Remove **Alarms & reminders** access.
2. Invoke the exact schedule action.
3. Confirm `NOTIFICATION_EXACT_PERMISSION_REQUIRED` occurs before any SQLite mutation or effect.
4. Restore an exact reminder through backup and confirm it remains exact and blocked rather than being downgraded.
5. Grant exact access and return to Pocket Tools.
6. Confirm reconciliation schedules the existing exact reminder.

### Recovery

1. Schedule a standard future reminder.
2. Force-stop and reopen Pocket Tools; confirm no duplicate desired or Android schedule appears.
3. Reboot the phone when practical and confirm supported recovery reconstructs the derived schedule.
4. Remove the tool and confirm all desired schedules, alarms, and active tap routes are removed even when ordinary tool data is retained.

## 8. Update, rollback, duplicate, and export

### Valid update

1. Edit only visible copy in the proof source while keeping `manifest.id` unchanged.
2. Check and preview it against cloned current state.
3. Confirm settings, records, timers, and aggregates appear in preview.
4. Install the update.
5. Confirm state and notification registry remain intact and rollback becomes available.

### Failed update

1. Edit a screen/action/notification target to an undeclared name.
2. Confirm check or preview rejects the candidate.
3. Confirm the installed source, last-known-good source, state, and schedules are unchanged.

### Rollback, duplicate, and export

1. Roll back and confirm the previous source returns without changing durable state.
2. Duplicate the tool and confirm source is copied but state and notifications are not.
3. Change the duplicate manifest ID before installation.
4. Export the active source and confirm the Android share sheet contains the exact current module.

## 9. Backup, removal, and restore

### Single-tool backup

1. Ensure the tool has records, changed settings, and at least one desired reminder.
2. Export a portable tool backup and confirm it declares backup version 2.
3. Remove the tool and data; confirm reminders are canceled.
4. Restore the backup.
5. Confirm source, settings, records, timer timestamps, and desired reminders are restored.
6. Confirm Android schedules are freshly derived rather than restoring device-specific pending-intent IDs.

### Complete-host backup

1. Create a complete host backup containing the proof tool and at least one SDK 1.0 or 1.1 tool.
2. Restore it transactionally.
3. Confirm all tools and versions remain usable.
4. Confirm malformed source or notification data rejects the complete restore without partially replacing host state.

## 10. Galaxy Watch4 Classic

With the watch paired and Pocket Tools enabled in Galaxy Wearable:

1. Post one ordinary Pocket Tools notification on the phone.
2. Confirm the phone notification appears.
3. Confirm the watch mirrors it when connection, Galaxy Wearable, channel, and system policy permit.
4. Record any Galaxy Wearable limitation separately from Pocket Tools behavior.

The pass condition is phone delivery plus expected platform mirroring when enabled. SDK 1.2 exposes no watch API and does not guarantee or inspect watch display.

## 11. Record results

Complete only from observed command and device evidence:

- Date:
- Commit:
- Device:
- Android version:
- Galaxy Watch / software version:
- Declaration generation:
- Bundled-source synchronization:
- `pnpm format`:
- `pnpm check`:
- Proof-source validation:
- Proof-source inspection:
- Expo JSON connected tests:
- Notification connected tests:
- QuickJS connected tests:
- Check / preview / install:
- Settings and native inputs:
- Transactional writes and rollback:
- Records, queries, and aggregates:
- UI, large font, and TalkBack:
- Feedback / copy / share:
- Notification permission and channel:
- Standard scheduling and cancellation:
- Exact-access failure and recovery:
- Tap routing:
- Force-stop / reboot reconciliation:
- Valid update:
- Failed update preservation:
- Rollback:
- Duplicate and export:
- Single-tool backup / remove / restore:
- Complete-host backup / restore:
- Galaxy Watch mirroring:
- Unexpected behavior:

SDK 1.2 is complete only when all required results pass, temporary acceptance changes are removed, the Part 2 PR is ready for review, and the tracker and roadmap record the final evidence.
