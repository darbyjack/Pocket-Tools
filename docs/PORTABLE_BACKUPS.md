# Portable Mini-App Backups

Pocket Tools can export one installed mini app as versioned JSON and restore it without rebuilding the Android host.

A single-app backup contains:

- Active source
- Last-known-good rollback source
- Manifest metadata and installation timestamps
- Isolated setting values
- Isolated records with host-owned IDs and timestamps
- Active durable timer start timestamps

The backup does not contain unrelated app state, host diagnostics, preview namespaces, application binaries, signing material, or device-specific secrets.

## Export

1. Open an installed mini app.
2. Choose **Backup**.
3. Use the Android share sheet to save or send the JSON text.
4. Preserve the suggested title `<Mini App Name>.pocket-tools-backup.json` when the destination supports naming shared text.

The existing **Export** action remains source-only. **Backup** is the portable stateful format.

## Restore

1. Open the mini-app library.
2. Choose **Restore backup**.
3. Paste one complete version 1 backup document.
4. Choose **Validate backup**.
5. Review the manifest ID and state counts.
6. Choose **Restore backup**.

If the manifest ID is not installed, Pocket Tools creates the installation and restores its state.

If the same manifest ID is already installed, Pocket Tools requires explicit confirmation before replacing it. Replacement is transactional: source, settings, records, and timers are all replaced together, or the existing installation remains unchanged.

## Validation boundary

Before SQLite changes begin, Pocket Tools:

1. Parses the exact `pocket-tools-mini-app` version 1 format.
2. Rejects unknown fields and unsupported versions rather than applying compatibility behavior.
3. Validates both saved sources through the frozen SDK v1 QuickJS inspection path.
4. Confirms both sources use the backed-up manifest ID.
5. Confirms active-source manifest metadata matches the backup metadata.
6. Validates every setting and record against the active or last-known-good source schema.
7. Rejects duplicate setting names, record IDs, timer IDs, malformed timestamps, invalid record IDs, and non-finite values.
8. Rejects reserved preview and lifecycle-diagnostic namespaces.

Data retained only for the last-known-good source remains portable so rollback state is not silently discarded.

## Timer behavior

An active timer is stored as its original UTC start timestamp. Restoring it does not replay JavaScript or synthesize elapsed values. On the next render, the host reconstructs elapsed time from that persisted timestamp in the same way it does after process death.

## Format stability

The current format is:

```json
{
  "format": "pocket-tools-mini-app",
  "version": 1,
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
  "timers": []
}
```

There are no migrations, deprecated aliases, or fallback readers. A future incompatible backup format requires an explicit version decision.

## Android acceptance

Before this slice is marked device-verified:

1. Run `pnpm check`.
2. Create recognizable settings, at least one record, and an active timer in an installed script.
3. Export its backup and retain the exact JSON.
4. Remove the app and its data.
5. Restore the backup and confirm source, settings, records, summaries, rollback availability, and timer elapsed time.
6. Modify the installed app, then restore the same backup with explicit replacement and confirm the complete previous state returns.
7. Attempt malformed, unsupported-version, wrong-manifest, and schema-invalid backups and confirm the installed app remains unchanged.
8. Relaunch Pocket Tools and confirm the restored state remains available.
