# Complete-Host Backups

Pocket Tools can export one versioned JSON document containing the complete user-owned mini-app state on the device and restore it without rebuilding the Android host.

## What is included

A complete-host backup contains:

- Every installed mini app.
- Each installed app's active source and last-known-good source.
- Manifest metadata and installation timestamps.
- All isolated settings, records, and active timer start timestamps.
- Retained settings, records, and timers for tools removed while keeping their data.

Temporary preview namespaces, lifecycle-diagnostic namespaces, application binaries, signing material, and internal host metadata are not exported.

## Export

1. Open **Settings**.
2. Choose **Back up everything**.
3. Use the Android share sheet to preserve the JSON text.
4. Keep the suggested name `Pocket Tools.pocket-tools-host-backup.json` when the destination supports naming shared text.

The per-tool **Back up tool** action remains available under **Manage**. **Back up everything** is the complete recovery document.

## Restore

1. Open **Settings**.
2. Choose **Restore everything**.
3. Paste one complete host-backup document.
4. Choose **Check backup**.
5. Review the tool, record, and timer counts.
6. Choose **Restore everything**.
7. Confirm **Replace everything**.

Restore replaces every installed mini app and every user-owned settings, records, and timer namespace in one SQLite transaction. The current tool collection remains unchanged if parsing, source inspection, validation, or a SQLite write fails.

## Validation boundary

Before replacement begins, Pocket Tools:

1. Parses the exact `pocket-tools-host` version 1 format.
2. Rejects unknown fields and unsupported versions.
3. Parses every nested `pocket-tools-mini-app` version 1 backup.
4. Rejects duplicate installed app IDs, retained app IDs, and globally duplicated record IDs.
5. Rejects overlap between installed and retained namespaces.
6. Rejects preview and lifecycle-diagnostic namespaces.
7. Inspects every active and last-known-good installed source through the embedded QuickJS runtime.
8. Validates installed settings and records against the active or rollback source schema.
9. Validates retained settings, records, timers, IDs, timestamps, and finite JSON structure.

Retained namespaces no longer have a source available to define their schema. They therefore receive strict structural validation rather than source-schema validation. Reinstalling a script remains responsible for accepting its retained state through the normal first-render and runtime validation path.

## Atomic replacement

The host validates the complete document before opening the replacement transaction. The transaction then:

1. Clears installed mini apps.
2. Clears settings, records, and active timers, including abandoned temporary state.
3. Restores installed app sources and state.
4. Restores removed-app retained namespaces.

The `app_metadata` table is preserved. This keeps one-time bundled-script seeding and other host-owned metadata independent from portable user data.

## Format outline

```json
{
  "format": "pocket-tools-host",
  "version": 1,
  "exportedAt": "2026-08-04T00:30:00.000Z",
  "apps": [
    {
      "format": "pocket-tools-mini-app",
      "version": 1,
      "exportedAt": "2026-08-04T00:30:00.000Z",
      "app": {},
      "settings": [],
      "records": [],
      "timers": []
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

There are no migrations, aliases, fallback readers, cloud destinations, or remote restore paths. A future incompatible host-backup format requires an explicit version decision.

## Android acceptance

Before this slice is marked device-verified:

1. Run `pnpm check`.
2. Keep at least two installed apps with recognizable settings and records.
3. Start a durable timer in one installed app.
4. Remove another test app while retaining its data.
5. Choose **Back up everything** and preserve the exact JSON.
6. Change or remove the installed apps and their state.
7. Choose **Restore everything**, check the document, and cancel the replacement once to prove cancellation is non-mutating.
8. Restore again and confirm all installed sources, settings, records, summaries, rollback sources, and timer timestamps return.
9. Reinstall the removed test app and verify its retained namespace remains available.
10. Attempt malformed, unsupported-version, duplicate-ID, internal-namespace, and invalid-source backups and confirm the current host state remains unchanged.
11. Force-stop and relaunch Pocket Tools and confirm the restored state persists.
