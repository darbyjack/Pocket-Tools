# Complete-Host Backups

Pocket Tools can export and restore all user-owned mini-app state as one versioned JSON document.

## Included state

A version-2 complete-host backup contains:

- every installed tool
- active and last-known-good source for each tool
- manifest metadata and installation timestamps
- isolated settings, records, and active timers
- installed-tool desired notification schedules
- retained settings, records, and timers for removed tools

Removed-tool retained namespaces contain no notifications. Preview and diagnostics state, Android scheduling identifiers, reconciliation status, binaries, signing material, and internal host metadata are excluded.

## Export and restore

Use **Settings → Back up everything** to share the JSON text.

Use **Settings → Restore everything** to paste, check, review, and confirm replacement. Restore replaces all installed tools and user-owned ordinary state in one SQLite transaction.

The `app_metadata` table and other host-owned metadata remain outside the portable document.

## Validation

Before replacement, the host:

1. requires `format: "pocket-tools-host"` and `version: 2`
2. validates every nested version-2 tool backup
3. rejects duplicate installed IDs, retained IDs, record IDs, and notification IDs
4. rejects overlap between installed and retained namespaces
5. rejects reserved preview and diagnostic namespaces
6. inspects every active and rollback source
7. validates settings, records, timers, and notification targets
8. enforces finite-value, timestamp, graph, and schedule limits
9. rejects notification state inside removed-tool retained namespaces

Version-1 documents, aliases, fallback readers, cloud destinations, and remote restore paths are unsupported.

## Atomic replacement

After complete validation, one transaction:

1. converts existing platform-backed schedules into cancellation work
2. clears installed tools and user-owned ordinary state
3. restores installed sources and state
4. restores installed desired notification schedules as pending reconciliation
5. restores removed-tool retained settings, records, and timers without notifications

Failure leaves the current host state unchanged.

After commit, reconciliation removes obsolete Android schedules and derives new platform state from the restored desired registry. Platform identifiers and delivery status are never trusted from the backup.

## Format outline

```json
{
  "format": "pocket-tools-host",
  "version": 2,
  "exportedAt": "2026-08-04T23:30:00.000Z",
  "apps": [],
  "retained": []
}
```

Use the [release and acceptance procedure](ORDINARY_SCRIPT_ACCEPTANCE.md) to verify multi-tool export, cancel behavior, atomic replacement, retained-state boundaries, notification reconciliation, and process-death recovery.
