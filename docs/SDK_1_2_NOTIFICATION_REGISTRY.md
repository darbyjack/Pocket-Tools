# SDK 1.2 Notification Registry and Protocol

## Status

This capability is public in SDK 1.2 and is available through ordinary authoring, validation, inspection, preview, installation, execution, update, rollback, export, backup/restore, and removal paths where applicable.

- `SDK_VERSION` is `"1.2"`.
- Supported manifest versions are `"1.0"`, `"1.1"`, and `"1.2"`.
- The public SDK source, generated declarations, local authoring runtime, embedded QuickJS runtime, host validators, and Android UI/lifecycle paths expose this capability.

Internal source, test, or helper names created during staged implementation may retain `sdk12` or `dormant` compatibility wording. Those names do not gate or expand the public API.

## Dormant action protocol

SDK 1.2 actions may internally produce:

```ts
type NotificationOperation =
  | {
      readonly type: "notification-schedule";
      readonly request: NotificationRequest;
    }
  | {
      readonly type: "notification-cancel";
      readonly notificationId: string;
    }
  | {
      readonly type: "notification-cancel-all";
    };
```

The embedded runtime exposes the dormant action-only client:

```ts
context.notifications.schedule(request);
context.notifications.cancel(id);
context.notifications.cancelAll();
```

The notification wrapper composes outside the previously merged feedback and everyday-query wrappers. It wraps only mutating settings, collection, and timer methods so notification operations can be merged into the exact original action-call order.

Notification operations count toward the same 256-operation SDK 1.2 action limit. Failed actions return no durable operation list.

## Request validation

The embedded runtime and trusted host independently enforce:

- exact request, trigger, and open-target keys
- lower-camel notification IDs with at most 80 Unicode code points
- titles containing 1–80 Unicode code points
- optional bodies containing 0–240 Unicode code points
- immediate triggers with no extra fields
- canonical future UTC millisecond timestamps for one-time action requests
- daily hours 0–23 and minutes 0–59
- weekly ISO weekdays 1–7, hours 0–23, and minutes 0–59
- `standard` or `exact` delivery only
- declared open screens
- finite serializable open input
- at most 64 desired schedules per installed storage identity

Scripts cannot provide channels, sounds, vibration patterns, images, notification actions, Android payloads, file paths, callbacks, or platform identifiers.

## Trusted response parsing

Normal response parsing still rejects every notification operation.

The explicit dormant SDK 1.2 parser:

1. Parses the native envelope as JSON.
2. Extracts only exact notification operation shapes.
3. Delegates all established operations, effects, UI, logs, and inspection values to the existing trusted parser.
4. Restores notification and established operations in their original interleaved order.

Malformed native results fail before SQLite persistence.

## Preflight and transaction ordering

The dormant SDK 1.2 storage executor performs notification preflight before opening the action transaction:

1. Confirms the inspected tool uses SDK 1.2.
2. Confirms the complete operation count is at most 256.
3. Loads the current desired notification IDs for the installed storage identity.
4. Replays schedule, cancel, and cancel-all operations in order against a working ID set.
5. Fully validates every scheduled request against the inspected tool and action timestamp.
6. Rejects a 65th desired schedule with `NOTIFICATION_LIMIT_EXCEEDED`.
7. Rejects exact delivery without preflighted special access using `NOTIFICATION_EXACT_PERMISSION_REQUIRED`.

Only after preflight succeeds does one SQLite transaction apply records, settings, timers, and notification registry mutations in serialized order. Any later validation or SQLite failure rolls the entire action back.

The Android scheduling slice will provide the real exact-alarm preflight value. This slice defaults it to unavailable rather than silently downgrading exact requests.

## Authoritative registry

The `notification_registry` table is the source of truth for desired notification state. Android schedules will be derived state.

Each row is keyed by:

- installed `storage_id`
- script-owned `notification_id`

This isolates duplicated tools even when they use the same script-owned ID. A deterministic host ID also incorporates the storage identity and is never exposed to scripts.

Rows contain:

- desired versus cancellation-tombstone state
- normalized request JSON for desired rows
- optional derived platform identifier
- `pending`, `scheduled`, `blocked`, or `failed` reconciliation status
- host-owned last error
- update and reconciliation timestamps

### Schedule and replacement

Scheduling an ID upserts desired state. Replacing an existing desired ID keeps any prior platform identifier so reconciliation can replace the derived Android schedule rather than losing track of it.

### Cancellation

Canceling an unscheduled desired row deletes it immediately.

Canceling a platform-backed row creates a tombstone by clearing desired request data and marking the row pending. The Android slice will delete the platform schedule and then remove the tombstone.

`cancelAll()` applies the same rule to every row owned by the installed storage identity.

### Reconciliation APIs

The registry exposes deterministic enumeration plus host-owned transitions for:

- marking a desired row scheduled with a platform identifier
- marking reconciliation blocked or failed
- completing a cancellation tombstone
- retrying pending desired and cancellation state

The next slice will compare the full desired registry with actual Android schedules at startup, after actions, after restore, and after permission changes.

## Runtime snapshots

The dormant SDK 1.2 snapshot loader adds a host-owned map of current desired requests keyed by script ID. This supports correct existing-schedule limit and replacement behavior when the final activation path switches actions to the notification-aware executor.

The map is not a public read API for scripts.

## Tool removal

The normal product removal path now uses an atomic notification-aware delete:

1. Desired rows without platform schedules are deleted.
2. Platform-backed rows become pending cancellation tombstones.
3. The installed app row is deleted.
4. Settings, records, and timers are deleted only when the user chooses **Remove data too**.

Notification desired state is always canceled, including when the user chooses **Keep data**. Reinstalling a removed tool therefore cannot silently reactivate old reminders.

## Backup format version 2

Both portable formats are now explicitly version 2:

- `pocket-tools-mini-app`
- `pocket-tools-host`

Installed tool backups contain normalized desired notification requests. They never contain platform identifiers, permission state, reconciliation errors, or delivery history.

Complete-host backups include notifications inside each installed app backup. Removed-tool retained namespaces remain limited to settings, records, and timers.

Version 1 documents are intentionally rejected. There is no implicit migration or missing-notification fallback.

Restore validation confirms notification shape, uniqueness, limits, finite input, and that open targets exist in at least one saved source. Restored requests become pending desired state. Existing platform-backed schedules that are absent from the backup remain cancellation tombstones until reconciliation removes them.

Exact requests remain exact during backup and restore. Restore does not silently downgrade them when current special access is unavailable.

## Security boundary

This slice exposes no:

- Android notification manager object
- alarm manager object
- notification permission APIs
- custom channel or sound configuration
- remote push token
- network access
- background QuickJS execution
- arbitrary Android intent or deep link
- direct Galaxy Watch targeting
- platform schedule identifier

The host remains responsible for all platform delivery, permission, accessibility, and reconciliation behavior.

## Coverage

Automated coverage includes:

- request and trigger shape validation
- Unicode title/body limits
- canonical and future one-time timestamps
- declared open screens and finite input
- normal-parser rejection and dormant-parser operation ordering
- exact-access preflight
- current-state and in-action 64-schedule limits
- storage-identity host-ID isolation
- portable and complete-host backup version 2 parsing
- duplicate and over-limit backup schedules
- saved-source target and SDK-version validation
- embedded immediate, date, daily, and weekly operations
- mixed settings, records, notification operations, and feedback ordering
- invalid request and render-context rejection
- desired and combined operation limits
- action-failure suppression
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

The Android build must compile the notification wrapper on top of all previously merged runner layers. Connected instrumentation must pass the notification suite and every prior QuickJS test.

## Next slice

The next notification slice adds:

- `expo-notifications`
- Android notification permission and channel setup
- monochrome notification icon configuration
- actual immediate, one-time, daily, and weekly scheduling
- exact-alarm special-access checks
- registry reconciliation and retry
- startup, restore, removal, and permission-change reconciliation
- notification tap routing to declared tool screens
- per-tool host controls
- phone and Galaxy Watch4 Classic mirrored-delivery acceptance
