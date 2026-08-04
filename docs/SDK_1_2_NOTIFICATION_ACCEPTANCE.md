# SDK 1.2 Physical Notification Acceptance

This checklist validates the Android host implemented by PR #51 without enabling public SDK 1.2 authoring or installation.

The temporary harness uses:

- an ordinary internal SDK 1.0 tool named **Notification Acceptance** as a real tap target
- diagnostics-only writes into the same authoritative notification registry used by dormant SDK 1.2 actions
- the production reconciliation, AlarmManager, NotificationManager, recovery, and deep-link paths

The automated connected suite remains the authority for SDK 1.2 script validation, operation ordering, limits, exact-access preflight, and transaction semantics.

## Install the acceptance build

From `apps/mobile/android`:

```powershell
.\gradlew.bat :app:installDebug --max-workers=4
```

Open Pocket Tools on the Galaxy S24 Ultra.

## Open the harness

1. Open **Settings → Notifications**.
2. Scroll to **Temporary physical acceptance**.
3. Choose **Install acceptance tool**.
4. Confirm the status changes to **Installed**.

The tool is intentionally visible and removable for this draft-only acceptance pass.

## Permission and channel

1. Before granting permission, choose **Immediate**.
2. Confirm the desired reminder remains listed as `blocked` and no notification appears.
3. Choose **Allow notifications** and grant Android permission.
4. Return to Pocket Tools and confirm foreground reconciliation delivers or schedules the blocked request.
5. Open **Android notification settings** and disable Pocket Tools notifications.
6. Create **Standard +2 min** and confirm it remains blocked.
7. Re-enable Pocket Tools notifications and confirm foreground reconciliation schedules it.
8. Disable only the **Pocket Tools reminders** channel and repeat the blocked/recovery check.

## Phone delivery and tap routing

1. Choose **Immediate** and confirm one phone notification appears.
2. Tap it with Pocket Tools already open.
3. Confirm **Notification tap target** opens and displays the `kind` and `createdAt` input.
4. Return to Notifications and choose **Standard +2 min**.
5. Terminate Pocket Tools before delivery.
6. After delivery, tap the notification and confirm the same target opens from a terminated app.
7. Confirm no mini-app action runs when a notification is tapped.

## Exact reminder

1. Remove **Alarms & reminders** access in Android settings.
2. Choose **Exact +3 min**.
3. Confirm the registry row remains exact and reports `blocked`; it must not be downgraded.
4. Choose **Allow exact reminders** and grant access.
5. Return to Pocket Tools and confirm foreground reconciliation schedules the exact row.
6. Confirm the notification fires at the requested minute.

The connected QuickJS and storage suites separately prove exact-action preflight occurs before SQLite persistence.

## Recurrence

1. Choose **Daily +2 min** and confirm delivery.
2. Return to the Notifications screen and confirm the daily row remains scheduled for its next local occurrence.
3. Choose **Weekly +2 min** and confirm delivery on the current ISO weekday.
4. Confirm the weekly row remains scheduled for its next local occurrence.
5. Change the device timezone and return to Pocket Tools.
6. Confirm foreground reconciliation keeps both recurring rows scheduled without duplicates.

## Replacement and cancellation

1. Choose **Replacement A**.
2. Immediately choose **Replacement B**.
3. Confirm only one `replacementReminder` row exists.
4. Confirm only the **Replacement B** notification fires.
5. Choose **Cancel all tests**.
6. Confirm all acceptance rows disappear after Android confirms cancellation.
7. Confirm any displayed acceptance notifications are removed.

## Recovery

1. Create **Standard +2 min**, **Daily +2 min**, and **Weekly +2 min**.
2. Force-stop Pocket Tools and relaunch it; confirm no duplicate rows or notifications appear.
3. Recreate future reminders with enough time remaining, reboot the phone, and confirm delivery after boot recovery.
4. Install the same updated debug build again and confirm package-update recovery remains idempotent.

## Galaxy Watch4 Classic mirroring

1. Pair and connect the Galaxy Watch4 Classic.
2. In Galaxy Wearable, allow Pocket Tools notifications for the watch.
3. Ensure sleep mode and Do Not Disturb are not suppressing notifications.
4. Deliver **Immediate**, **Standard +2 min**, and **Exact +3 min** reminders.
5. Confirm each phone notification mirrors to the watch when Samsung/Wear OS policy permits.
6. Disable Pocket Tools notifications for the watch.
7. Confirm the phone still receives reminders while the watch does not.

This validates mirroring only. Pocket Tools does not directly target or detect the watch.

## Mandatory cleanup before merge

1. Open **Settings → Notifications**.
2. Choose **Cancel all tests**.
3. Choose **Remove acceptance tool**.
4. Confirm the acceptance tool is no longer installed and host desired/scheduled/blocked/failed counts return to the expected baseline.
5. Remove the temporary harness source and UI from PR #51 before merging.
