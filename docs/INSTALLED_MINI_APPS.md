# Installed Mini-App Lifecycle

Pocket Tools stores mini-app source as application data. Installing, updating, or removing a script does not require rebuilding the Android host.

## One execution path

Bundled reference scripts are imported into the installed-app table only once on first launch. After that, bundled and pasted scripts are indistinguishable:

```text
installed_mini_apps.active_source
  → generic inspect and validation
  → isolated QuickJS-NG runtime
  → host-owned native renderer
  → settings, records, and timers under the installed manifest ID
```

There is no app-specific hook, renderer, storage adapter, or runtime branch.

## Stored installation record

Each installed script stores:

- Permanent `manifest.id`
- Current manifest name, description, and icon
- Active source
- Last-known-good source
- Installation timestamp
- Last update timestamp

The manifest ID is the permanent namespace for installed settings, records, and timers. Editing an installed script cannot change it. To create a separate app, duplicate the source and change the manifest ID before installing.

## Paste and validation

The Android editor accepts one multiline JavaScript ES module. `Validate` executes the script through the frozen embedded SDK and inspects its manifest, settings, collections, screens, and actions.

Validation errors preserve the runtime error code, script stack, and bounded console output when available. The editor does not expose syntax highlighting, formatting, arbitrary imports, or a second SDK implementation.

## Isolated preview

Preview never uses the installed app namespace directly.

For a new or duplicated script, Pocket Tools creates an empty temporary namespace. For an update, it clones the installed app's current settings, records, and timers into a temporary namespace. Record IDs are regenerated inside the clone because record IDs are host-owned and no SDK v1 field can reference another record.

All preview setting changes, record operations, and timers are written only to that disposable namespace. Preview data is cleared when the source changes, a new preview starts, the editor closes, or installation succeeds. Stale preview namespaces are safe to remove at startup.

The install or update button remains disabled until the exact current source completes its first native render. Changing even one character invalidates the approval.

## Install and update

A new install writes its source and manifest metadata in one SQLite statement after preview passes.

An update does not modify the installed source during validation or preview. After the candidate renders successfully against a cloned copy of current state, Pocket Tools atomically:

1. Moves the current active source to `last_known_good_source`.
2. Stores the candidate as the new active source.
3. Updates manifest metadata and the update timestamp.

Validation, preview, or first-render failure therefore leaves the current installation untouched.

## Rollback

After an update, the runner exposes `Roll back`. Pocket Tools validates the saved last-known-good source, then swaps it with the active source. Settings, records, and timers are not changed.

The swap is reversible, so rolling back again returns to the newer source.

## Export and duplication

`Export` uses the Android share sheet to send the active source as text.

`Duplicate` opens the active source in the editor but does not copy installed state. The user or authoring agent must assign a new manifest ID before installation.

## Removal

Removing an app always deletes its installation record. The user chooses whether to:

- Keep isolated settings, records, and timers for a future reinstall with the same manifest ID.
- Delete the installation and all associated app data.

## Fixed authority disclosure

Installed scripts have the same fixed SDK v1 authority as bundled scripts:

- Isolated local settings
- Isolated local collections and queries
- Isolated durable timers
- Declarative native UI

Scripts do not receive network, filesystem, location, notifications, secrets, React Native, Android APIs, custom native modules, or arbitrary background JavaScript.

## Manual Android acceptance

Before this phase is considered device-verified, exercise the following on an emulator or device:

1. Paste and validate a valid SDK v1 script.
2. Preview it, change settings, add records, and start a timer.
3. Cancel the editor and verify the installed app was not changed.
4. Install the script and reopen it after process termination.
5. Edit and preview an update against cloned current state.
6. Introduce a validation or first-render failure and verify the active source remains unchanged.
7. Apply a valid update, roll it back, and verify app data remains intact.
8. Export and duplicate the source.
9. Remove the app while keeping data, reinstall the same ID, and verify recovery.
10. Remove the app and data, reinstall the same ID, and verify a clean state.
