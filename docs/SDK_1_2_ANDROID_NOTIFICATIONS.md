# SDK 1.2 Android Notification Delivery

## Status

This capability is public in SDK 1.2 and is available through ordinary authoring, validation, inspection, preview, installation, execution, update, rollback, export, backup/restore, and removal paths where applicable.

- `SDK_VERSION` is `"1.2"`.
- Supported manifest versions are `"1.0"`, `"1.1"`, and `"1.2"`.
- The public SDK source, generated declarations, local authoring runtime, embedded QuickJS runtime, host validators, and Android UI/lifecycle paths expose this capability.

Internal source, test, or helper names created during staged implementation may retain `sdk12` or `dormant` compatibility wording. Those names do not gate or expand the public API.

## Architecture

SQLite remains the authoritative desired-notification registry.

The Android scheduler is a derived cache only:

```text
validated SDK 1.2 action or backup restore
  → one SQLite transaction
  → committed desired registry
  → serialized host reconciliation
  → Android AlarmManager / NotificationManager
  → reconciliation status written back to SQLite
```

The Android layer never:

- executes QuickJS
- reads or writes mini-app collections or settings
- invokes a mini-app action
- performs network requests
- obtains a push token
- chooses a script-owned channel, sound, icon, vibration, or notification action

## Android host module

`@pocket-tools/notifications-runtime` owns:

- the single `pocket-tools-reminders` notification channel
- Android notification-enabled and channel-enabled checks
- exact-alarm access checks
- standard and exact local alarms
- notification posting
- boot, package-update, clock, timezone, and exact-access recovery
- private derived schedule state for reboot recovery
- private opaque tap-routing state

The module uses:

- `AlarmManager.setAndAllowWhileIdle` for standard reminders
- `AlarmManager.setExactAndAllowWhileIdle` for exact reminders
- immutable pending intents with host-owned identifiers
- one monochrome Android small icon

A script never sees an Android identifier. The native identity is derived from installed storage identity plus the script-owned notification ID.

## Permission behavior

Pocket Tools creates the reminders channel before requesting Android 13+ notification permission.

The host settings screen exposes:

- notification permission state
- reminders-channel state
- exact-alarm access state
- desired, scheduled, blocked, and failed counts
- Android notification settings
- Alarms & reminders settings
- explicit reconciliation retry

A denied notification permission or disabled channel does not delete desired schedules. Rows remain blocked and are retried after the app returns to the foreground.

Exact reminders are never silently downgraded. The dormant action-storage path requires exact access before persistence. Restored exact reminders remain exact and may appear blocked until access is granted.

## Trigger behavior

### Immediate

An immediate request is posted as soon as Android permits after the SQLite commit. Its desired row is removed after successful delivery.

The native tap target remains available for 30 days so a notification can still open correctly after its desired row has been cleaned up.

### One-time date

A future canonical UTC instant is scheduled once.

- Successful delivery removes the desired row during the next host reconciliation.
- An undelivered request whose instant has passed is expired and removed.
- A delivered notification retains its tap route for 30 days.

### Daily

Daily reminders are calculated in the device's current local timezone. After delivery, Android calculates and schedules the next local occurrence.

### Weekly

Weekly reminders use the SDK contract's ISO weekday numbering:

- Monday = `1`
- Sunday = `7`

The next local weekly occurrence is recalculated after every delivery and after clock, timezone, boot, or package-update recovery.

## Reconciliation points

Pocket Tools reconciles:

- at application startup
- when the application returns to the foreground
- after notification permission or exact-alarm settings return control to the app
- after single-tool restore
- after complete-host restore
- after tool removal
- through the dormant SDK 1.2 post-commit action hook

Reconciliation is serialized. Overlapping callers join one queue rather than racing Android scheduling or SQLite status updates.

Native results are exact-key validated before they can update SQLite.

## Reconciliation states

- `pending`: desired state has changed and awaits Android reconciliation
- `scheduled`: Android accepted the derived alarm
- `blocked`: permission, channel, or exact access prevents scheduling
- `failed`: Android or the native bridge returned another recoverable failure

Cancellation tombstones remain until Android confirms cancellation. Completed cancellation rows are then removed.

## Tap routing

Notifications launch:

```text
pocket-tools://notification?hostId=<opaque-host-id>
```

JavaScript receives only the opaque host ID from the URL. It asks the private native cache for the validated installed storage ID, notification ID, screen, and finite serializable input.

The app then:

1. confirms the installed tool still exists
2. opens the requested screen when the current source still declares it
3. falls back to `home` when the saved screen no longer exists
4. opens the library with a concise message when the tool is no longer installed

A notification tap never invokes a mini-app action.

## Removal and restore

Removing a tool always reconciles its reminder state, even when ordinary tool data is retained.

- scheduled alarms are canceled
- active notification routing is removed for canceled reminders
- reinstalling the same manifest ID does not reactivate old desired schedules

Backup version 2 remains portable desired state only. Android pending-intent IDs, channel state, permission state, reconciliation errors, and delivery history are never exported.

## Galaxy Watch4 Classic behavior

Pocket Tools posts an ordinary notification on the paired Android phone. Samsung Galaxy Wearable and Wear OS may mirror it to the paired Galaxy Watch4 Classic.

There is no watch-targeting SDK field and no delivery guarantee. Scripts cannot detect the watch or determine whether the watch displayed the notification.

## Automated validation

Run:

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

The connected suite must include the notification recurrence tests and every existing QuickJS instrumentation test.

## Physical Galaxy S24 Ultra acceptance

Use a temporary internal SDK 1.2 fixture through the dormant host path. Do not activate normal SDK 1.2 installation.

### Permission and channel

1. Install a clean debug build.
2. Open **Settings → Notifications**.
3. Confirm notification permission is not allowed before the first request on Android 13+.
4. Choose **Allow notifications** and grant permission.
5. Confirm the reminders channel reports enabled.
6. Disable Pocket Tools notifications in Android settings.
7. Reconcile and confirm desired reminders remain visible as blocked.
8. Re-enable notifications, return to Pocket Tools, and confirm foreground reconciliation schedules them.
9. Disable only the reminders channel and repeat the blocked/recovery check.

### Standard reminders

1. Schedule one immediate reminder and confirm one notification appears.
2. Schedule a future one-time standard reminder and confirm delivery.
3. Schedule a daily standard reminder several minutes ahead and confirm delivery plus next-occurrence rescheduling.
4. Schedule a weekly reminder using the current ISO weekday and confirm delivery.
5. Replace a reminder using the same ID and confirm only the replacement fires.
6. Cancel one reminder and confirm its alarm and displayed notification are removed.
7. Cancel all reminders for the tool and confirm the per-tool screen becomes empty.

### Exact reminders

1. Remove Alarms & reminders access.
2. Attempt an exact action mutation and confirm `NOTIFICATION_EXACT_PERMISSION_REQUIRED` occurs before any SQLite mutation.
3. Restore an exact reminder from backup and confirm it remains visible as blocked rather than being downgraded.
4. Open **Allow exact reminders**, grant access, and return to Pocket Tools.
5. Confirm foreground reconciliation schedules the exact reminder.
6. Confirm the exact reminder fires at the requested minute.

### Recovery

1. Schedule standard daily, weekly, and future one-time reminders.
2. Force-stop and relaunch Pocket Tools; confirm registry and Android state reconcile without duplicates.
3. Reboot the phone and confirm the native recovery receiver restores future alarms without running QuickJS.
4. Change the device timezone and confirm daily and weekly reminders move to the correct local occurrence.
5. Change the clock and confirm no duplicate alarm is created.
6. Install an updated debug build and confirm package-update recovery remains idempotent.

### Tap routing

1. Schedule a reminder targeting a declared non-home screen with finite input.
2. Tap it from a terminated app and confirm the target screen/input opens.
3. Tap another while Pocket Tools is already open and confirm the same route opens through `onNewIntent`.
4. Update the tool so the saved screen no longer exists; tap and confirm `home` opens.
5. Remove the tool and tap an already displayed notification; confirm the library opens with an unavailable-tool message.
6. Confirm no tap invokes a mini-app action.

### Backup and removal

1. Back up a tool with standard and exact desired reminders.
2. Remove it while keeping ordinary data and confirm Android alarms are canceled.
3. Reinstall the script and confirm retained ordinary data does not reactivate reminders.
4. Restore the version-2 backup and confirm desired reminders return as pending, then reconcile.
5. Restore a complete-host backup and confirm obsolete alarms are canceled and restored desired state is scheduled once.

## Galaxy Watch4 Classic acceptance

1. Pair the Galaxy Watch4 Classic and enable Pocket Tools notifications in Galaxy Wearable.
2. Confirm the watch is connected and not suppressing notifications through sleep mode or Do Not Disturb.
3. Deliver an immediate phone reminder and confirm it mirrors to the watch.
4. Deliver one standard scheduled reminder and one exact reminder and confirm both mirror when system policy permits.
5. Disable Pocket Tools notifications for the watch and confirm the phone still receives them while the watch does not.
6. Record this as mirroring acceptance only; it is not direct or guaranteed watch delivery.
