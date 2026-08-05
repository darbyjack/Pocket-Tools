# SDK 1.2 Local Notifications

SDK 1.2 exposes a narrow tool-scoped local notification client. SQLite stores validated desired schedules; Android alarms and posted notifications are derived host state.

The normative API is defined in the [SDK 1.2 Contract](SDK_1_2_CONTRACT.md).

## Public operations

Schedule or replace a notification by stable ID:

```js
context.notifications.schedule({
  id: "dailyReminder",
  title: "Review entries",
  body: "Open Pocket Tools to continue.",
  trigger: {
    type: "daily",
    hour: 17,
    minute: 0,
    delivery: "standard",
  },
  open: {
    screen: "home",
  },
});
```

Cancel one ID or every schedule owned by the tool:

```js
context.notifications.cancel("dailyReminder");
context.notifications.cancelAll();
```

Notification writes are action-only and participate in the same validated transaction as settings, records, and timers.

## Triggers

Supported trigger types are:

- `immediate`
- `date` with canonical UTC `at`
- `daily` with local `hour` and `minute`
- `weekly` with weekday 1 through 7 plus local `hour` and `minute`

Date, daily, and weekly requests may use `delivery: "standard"` or `"exact"`. Standard is the default.

Exact delivery is never silently downgraded. Creating an exact request without required Android access fails before persistence with the notification layer's stable error. An exact request restored from backup remains exact and blocked until access is granted.

## Routing

An optional `open` target may name a declared screen and carry finite serializable input.

A notification tap:

1. resolves a host-owned pending intent
2. validates the installed manifest and target screen
3. opens the tool and screen, or a safe fallback
4. never invokes a mini-app action

Scripts cannot observe delivery, tap events, permission state, channel state, or routing internals.

## Android-owned behavior

Pocket Tools owns:

- notification permission
- the reminders channel
- exact-alarm access checks and recovery guidance
- standard and exact AlarmManager scheduling
- host notification and pending-intent identifiers
- foreground and startup reconciliation
- boot, package-update, clock, and timezone recovery
- update, restore, and removal reconciliation
- blocked and failed status with retry
- tap-routing cache and fallback behavior

Denied permission or a disabled channel does not erase desired standard schedules. The registry retains them as blocked state for later reconciliation.

## Registry and lifecycle

A schedule ID is unique within one installed tool. Scheduling the same ID replaces the desired request.

The desired registry is included in version-2 tool and complete-host backups. Backups exclude Android identifiers, permission/channel state, exact-access state, reconciliation errors, delivery history, and watch state.

Preview notification requests never acquire installed-tool authority. Updating or restoring a tool reconciles the committed desired registry. Removing a tool always removes desired schedules and cancels derived Android state, even when ordinary settings, records, and timers are retained.

## Watch mirroring

A normal Pocket Tools phone notification may mirror to a paired watch through Android and Galaxy Wearable settings. Pocket Tools exposes no Wear OS API, watch targeting, delivery guarantee, or mirroring inspection.

## Security boundary

Scripts cannot:

- create channels, sounds, images, custom actions, or full-screen intents
- bypass Do Not Disturb
- access remote push
- run background QuickJS for delivery
- request arbitrary Android permissions
- inspect paired devices
- receive callbacks or delivery receipts

Every request is validated for version, stable ID, bounded text, exact trigger keys, canonical timestamps, recurrence bounds, delivery mode, declared screen target, finite input, and per-tool schedule limits.
