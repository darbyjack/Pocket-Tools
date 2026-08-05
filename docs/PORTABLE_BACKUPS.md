# Portable Mini-App Backups

Pocket Tools can export one installed tool as versioned JSON and restore it without rebuilding the Android host.

## Included state

A version-2 tool backup contains:

- active source and last-known-good source
- manifest metadata and installation timestamps
- validated setting values
- records with host-owned IDs and timestamps
- active timer UTC start timestamps
- validated desired notification schedules

It excludes unrelated tools, preview and diagnostic namespaces, Android alarm or pending-intent IDs, notification permission/channel state, reconciliation errors, delivery history, binaries, signing material, and device secrets.

## Export

Open the installed tool and choose **Manage → Back up tool**. The Android share sheet receives the versioned JSON text.

**Export script** is source-only. **Back up tool** is the portable stateful format.

## Restore

Open **Settings → Restore a tool**, paste one complete backup, choose **Check backup**, review the summary, and choose **Restore tool**.

Replacing an installed or retained manifest ID requires explicit confirmation. Source, settings, records, timers, and desired notifications are replaced in one transaction. Any parse, validation, inspection, or SQLite failure leaves the existing installation unchanged.

## Validation

Before persistence, the host:

1. requires `format: "pocket-tools-mini-app"` and `version: 2`
2. rejects unknown fields and unsupported versions
3. inspects both saved sources through the embedded QuickJS runtime
4. confirms both sources use the backed-up manifest ID
5. validates manifest metadata
6. validates settings and records against the applicable source schema
7. validates timer IDs and UTC timestamps
8. validates notification IDs, text, triggers, delivery, open targets, and finite input
9. enforces duplicate, reserved-namespace, graph, and schedule limits

Version-1 documents are intentionally unsupported. There are no fallback readers or migrations.

## Timers

An active timer restores its original UTC start timestamp. The host reconstructs elapsed time at render; restore does not replay JavaScript.

## Notifications

Only desired schedules are portable. Android identifiers and device authority are derived again during reconciliation.

An exact request remains exact. When current Android access is unavailable, the schedule remains blocked until access is granted; it is never silently downgraded.

## Format outline

```json
{
  "format": "pocket-tools-mini-app",
  "version": 2,
  "exportedAt": "2026-08-04T23:30:00.000Z",
  "app": {
    "id": "example-tool",
    "name": "Example Tool",
    "activeSource": "...",
    "lastKnownGoodSource": "...",
    "installedAt": "2026-08-04T20:00:00.000Z",
    "updatedAt": "2026-08-04T21:00:00.000Z"
  },
  "settings": [],
  "records": [],
  "timers": [],
  "notifications": []
}
```

Use the [release and acceptance procedure](ORDINARY_SCRIPT_ACCEPTANCE.md) to verify export, removal, replacement, restore, timer recovery, and notification reconciliation on Android.
