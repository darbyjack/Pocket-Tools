# Portable Mini-App Backups

Pocket Tools can export one installed mini app as versioned JSON and restore it without rebuilding the Android host.

A single-app backup contains:

- Active source
- Last-known-good rollback source
- Manifest metadata and installation timestamps
- Isolated setting values
- Isolated records with host-owned IDs and timestamps
- Active durable timer start timestamps
- Validated desired notification schedules

The backup does not contain unrelated app state, host diagnostics, preview namespaces, derived Android schedule IDs, reconciliation errors, application binaries, signing material, or device-specific secrets.

## Export

1. Open an installed tool.
2. Choose **Manage**.
3. Choose **Back up tool**.
4. Use the Android share sheet to save or send the JSON text.
5. Preserve the suggested title `<Tool Name>.pocket-tools-backup.json` when the destination supports naming shared text.

**Export script** remains source-only. **Back up tool** is the portable stateful format.

## Restore

1. Open **Settings**.
2. Choose **Restore a tool**.
3. Paste one complete version 2 backup document.
4. Choose **Check backup**.
5. Review the tool and state counts.
6. Choose **Restore tool**.

If the manifest ID has no installation or retained namespace, Pocket Tools creates the installation and restores its state.

If the same manifest ID is installed or has data retained after removal, Pocket Tools requires explicit confirmation before replacing it. Replacement is transactional: source, settings, records, timers, and desired notification schedules are all replaced together, or the previous installation and retained state remain unchanged.

Restored notification schedules become pending desired state. Android delivery is derived from that registry during reconciliation; platform schedule identifiers and prior delivery status are never trusted from a backup.

## Validation boundary

Before SQLite changes begin, Pocket Tools:

1. Parses the exact `pocket-tools-mini-app` version 2 format.
2. Rejects version 1 documents, unknown fields, and unsupported versions rather than applying compatibility behavior.
3. Validates both saved sources through the embedded QuickJS inspection path.
4. Confirms both sources use the backed-up manifest ID.
5. Confirms active-source manifest metadata matches the backup metadata.
6. Validates every setting and record against the active or last-known-good source schema.
7. Validates notification IDs, titles, bodies, triggers, delivery modes, open screens, and finite inputs.
8. Requires at least one saved SDK 1.2 source when notification schedules are present.
9. Rejects duplicate setting names, record IDs, timer IDs, notification IDs, malformed timestamps, invalid record IDs, non-finite values, and more than 64 schedules.
10. Rejects reserved preview and lifecycle-diagnostic namespaces.

Data retained only for the last-known-good source remains portable so rollback state is not silently discarded.

## Timer behavior

An active timer is stored as its original UTC start timestamp. Restoring it does not replay JavaScript or synthesize elapsed values. On the next render, the host reconstructs elapsed time from that persisted timestamp in the same way it does after process death.

## Notification behavior

Only desired requests are portable. The backup does not contain:

- Android notification identifiers
- permission state
- exact-alarm special-access state
- channel state
- blocked or failed reconciliation messages
- delivery history
- watch-delivery state

A restored exact request remains exact. The host does not silently downgrade it. If current device access is unavailable, later reconciliation records a host-owned blocked state until the user grants access or changes the reminder.

## Format stability

The current format is:

```json
{
  "format": "pocket-tools-mini-app",
  "version": 2,
  "exportedAt": "2026-08-03T21:30:00.000Z",
  "app": {
    "id": "example-tool",
    "name": "Example Tool",
    "activeSource": "...",
    "lastKnownGoodSource": "...",
    "installedAt": "2026-08-03T20:00:00.000Z",
    "updatedAt": "2026-08-03T21:00:00.000Z"
  },
  "settings": [],
  "records": [],
  "timers": [],
  "notifications": [
    {
      "id": "dailyReminder",
      "title": "Daily reminder",
      "trigger": {
        "type": "daily",
        "hour": 8,
        "minute": 30,
        "delivery": "standard"
      }
    }
  ]
}
```

There are no migrations, deprecated aliases, or fallback readers. Version 1 documents are intentionally unsupported after the version-2 cutover.

## Android acceptance

Full notification delivery acceptance belongs to the Android scheduling slice. The final backup acceptance must prove:

1. `pnpm check` passes.
2. A tool with recognizable settings, records, an active timer, and desired reminders exports exact version-2 JSON.
3. Removing the app deletes desired reminders even when ordinary data is retained.
4. Restoring the backup restores source, settings, records, timer state, rollback availability, and desired reminders.
5. Replacement leaves obsolete platform schedules queued for cancellation and restored schedules queued for reconciliation.
6. Malformed, version-1, wrong-manifest, schema-invalid, duplicate-notification, and over-limit backups leave the installed app unchanged.
7. Force-stop and relaunch preserve the restored desired registry.
