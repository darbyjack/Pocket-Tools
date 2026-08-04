# Complete-Host Backups

Pocket Tools can export one versioned JSON document containing the complete user-owned mini-app state on the device and restore it without rebuilding the Android host.

## What is included

A complete-host backup contains:

- Every installed mini app.
- Each installed app's active source and last-known-good source.
- Manifest metadata and installation timestamps.
- All isolated settings, records, and active timer start timestamps.
- Every installed tool's validated desired notification schedules.
- Retained settings, records, and timers for tools removed while keeping their data.

Removed-tool retained namespaces never include notifications. Removing a tool always cancels its desired reminders, even when ordinary settings and records are retained.

Temporary preview namespaces, lifecycle-diagnostic namespaces, derived Android schedule IDs, reconciliation status, application binaries, signing material, and internal host metadata are not exported.

## Export

1. Open **Settings**.
2. Choose **Back up everything**.
3. Use the Android share sheet to preserve the JSON text.
4. Keep the suggested name `Pocket Tools.pocket-tools-host-backup.json` when the destination supports naming shared text.

The per-tool **Back up tool** action remains available under **Manage**. **Back up everything** is the complete recovery document.

## Restore

1. Open **Settings**.
2. Choose **Restore everything**.
3. Paste one complete version 2 host-backup document.
4. Choose **Check backup**.
5. Review the tool, record, timer, and reminder counts.
6. Choose **Restore everything**.
7. Confirm **Replace everything**.

Restore replaces every installed mini app and every user-owned settings, records, timer, and installed-tool notification namespace in one SQLite transaction. The current tool collection remains unchanged if parsing, source inspection, validation, or a SQLite write fails.

Obsolete platform schedules are preserved only as host-owned cancellation tombstones until Android reconciliation confirms removal. Restored desired requests are queued for reconciliation and never inherit platform identifiers or delivery status from the backup.

## Validation boundary

Before replacement begins, Pocket Tools:

1. Parses the exact `pocket-tools-host` version 2 format.
2. Rejects version 1 documents, unknown fields, and unsupported versions.
3. Parses every nested `pocket-tools-mini-app` version 2 backup.
4. Rejects duplicate installed app IDs, retained app IDs, globally duplicated record IDs, and duplicate notification IDs within a tool.
5. Rejects overlap between installed and retained namespaces.
6. Rejects preview and lifecycle-diagnostic namespaces.
7. Inspects every active and last-known-good installed source through the embedded QuickJS runtime.
8. Validates installed settings, records, and notification open targets against the active or rollback source schema.
9. Validates notification IDs, title/body limits, trigger fields, canonical timestamps, delivery modes, finite inputs, and the 64-schedule limit.
10. Validates retained settings, records, timers, IDs, timestamps, and finite JSON structure.
11. Rejects notification state inside retained removed-tool namespaces.

Retained namespaces no longer have a source available to define their schema. They therefore receive strict structural validation rather than source-schema validation. Reinstalling a script remains responsible for accepting its retained ordinary state through the normal first-render and runtime validation path.

## Atomic replacement

The host validates the complete document before opening the replacement transaction. The transaction then:

1. Converts existing platform-backed schedules into cancellation tombstones and deletes unscheduled registry rows.
2. Clears installed mini apps.
3. Clears settings, records, and active timers, including abandoned temporary state.
4. Restores installed app sources and ordinary state.
5. Restores each installed app's desired notification schedules as pending registry state.
6. Restores removed-app retained settings, records, and timers without notifications.

The `app_metadata` table is preserved. This keeps one-time bundled-script seeding and other host-owned metadata independent from portable user data.

## Format outline

```json
{
  "format": "pocket-tools-host",
  "version": 2,
  "exportedAt": "2026-08-04T00:30:00.000Z",
  "apps": [
    {
      "format": "pocket-tools-mini-app",
      "version": 2,
      "exportedAt": "2026-08-04T00:30:00.000Z",
      "app": {},
      "settings": [],
      "records": [],
      "timers": [],
      "notifications": []
    }
  ],
  "retained": [
    {
      "appId": "removed-tool",
      "settings": [],
      "records": [],
      "timers": []
    }
  ]
}
```

There are no migrations, aliases, fallback readers, cloud destinations, or remote restore paths. Version 1 documents are intentionally unsupported after the version-2 cutover.

## Android acceptance

Full notification delivery acceptance belongs to the Android scheduling slice. Final complete-host acceptance must prove:

1. `pnpm check` passes.
2. At least two installed tools with recognizable state and desired reminders are exported.
3. A removed tool with retained ordinary data contributes no notification schedules.
4. Canceling replacement is non-mutating.
5. Restore returns all installed sources, settings, records, summaries, rollback sources, timers, and desired reminders.
6. Obsolete Android schedules are removed during reconciliation and restored schedules are created once.
7. Reinstalling a removed tool does not reactivate reminders that were absent from the backup.
8. Malformed, version-1, duplicate-ID, over-limit, internal-namespace, and invalid-source backups leave current host state unchanged.
9. Force-stop and relaunch preserve the restored desired registry.
