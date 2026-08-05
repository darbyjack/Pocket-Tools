# Installed Mini-App Lifecycle

Pocket Tools stores mini-app source and state as application data. Installing, updating, rolling back, exporting, backing up, restoring, or removing a tool does not require rebuilding the Android host.

## One execution path

Bundled examples are seeded once. Bundled and pasted sources then use the same path:

```text
installed active source
  → inspection and validation
  → fresh bounded QuickJS-NG invocation
  → host validation
  → native UI and host-owned services
  → isolated settings, records, timers, and notifications
```

There is no tool-specific renderer, storage adapter, action branch, or notification path.

## Installation record and namespace

Each installed tool stores:

- immutable `manifest.id`
- current name, description, and icon metadata
- active source
- last-known-good source
- installation and update timestamps

The manifest ID is the permanent namespace for settings, records, timers, and desired notifications. Editing cannot change it. Duplication requires a new manifest ID and copies source only.

## Check and inspection

**Add tool** accepts one JavaScript ES module. **Check** executes the source through the embedded SDK and validates its manifest, definitions, screens, actions, and public version authority.

Errors preserve stable codes, bounded script stack, validation issues, console output, and truncation state when available. A successful check alone does not authorize installation.

## Isolated preview

Preview uses a reserved disposable namespace.

For an update or reinstall, Pocket Tools clones retained settings, records, and timers into preview. Record IDs are regenerated inside the clone. Desired installed notifications are not copied as active platform authority; preview schedule operations remain isolated from the installed registry.

Preview is cleared when source changes, a new preview begins, the editor closes, installation succeeds, or startup removes abandoned preview state.

The install or update action remains unavailable until the exact current source completes its first native render.

## Retained-state render gate

Immediately before persistence, the host performs a read-only home render using the exact retained installed namespace. Missing new setting values are supplied from declared defaults in memory.

This catches schema, retained-data, notification-target, or record-ID-dependent failures without changing source or state. Failure leaves the current installation untouched.

## Install and update

A new install persists the validated source and metadata after both render gates pass.

A successful update atomically:

1. moves active source to `last_known_good_source`
2. stores the candidate as active source
3. updates manifest metadata and timestamp

Settings, records, timers, and desired notification state remain under the same manifest namespace. The committed source is then used for notification reconciliation and normal rendering.

Validation, preview, or either render-gate failure leaves active source and retained state unchanged.

## Rollback

**Manage → Roll back** validates the saved source and swaps it with active source. Durable tool data is unchanged. The swap is reversible.

A rollback source must still accept the current retained state and notification targets through normal validation.

## Export, duplicate, and backup

- **Export script** shares active source as text.
- **Duplicate** opens source in the editor without copying state and requires a new manifest ID.
- **Back up tool** exports version-2 JSON containing both sources, metadata, settings, records, active timer timestamps, and desired notification registry.

See [Portable Mini-App Backups](PORTABLE_BACKUPS.md).

## Removal

Removing a tool always deletes its installation record and desired notifications and cancels derived Android schedules.

The user may:

- retain settings, records, and timers for a later reinstall using the same manifest ID
- delete the complete ordinary namespace

Retained removed-tool state contains no notifications. Reinstallation must pass the same preview and retained-state gates before the namespace becomes active again.

## Recovery

On startup and foreground transitions, the host reloads installed source and durable state, clears abandoned preview/diagnostic namespaces, and reconciles desired notifications with Android.

Timers recover from persisted UTC start timestamps. Notifications recover from the desired registry. Neither requires a surviving QuickJS or React Native process.

## Authority

Installed SDK 1.0, 1.1, and 1.2 tools receive only their documented versioned authority. SDK 1.2 includes isolated local settings and records, transactional writes, durable timers, host-owned UI and output, and tool-scoped local notifications.

No installed source receives arbitrary network, filesystem, location, secrets, native modules, platform components, permission manifests, remote push, or background JavaScript.
