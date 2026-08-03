# First Android Mini-App Slice

## End-to-end path

Files under `examples/*.miniapp.js` are mini-app scripts, not host implementation files. `scripts/sync-bundled-mini-apps.mjs` discovers every matching script and writes a generated JSON data catalog for the Expo application. The repository check fails when that catalog is stale.

The host imports only the catalog and passes the selected source string to the generic `useMiniApp(source)` path. No hook, storage adapter, renderer, or runtime branch knows that Bathroom Pay exists. Bathroom Pay remains the first reference script because it exercises the current SDK end to end.

For each inspection, render, or action request:

1. React Native loads current settings, records, and active timers from Expo SQLite.
2. The native Expo module creates a fresh bounded QuickJS-NG runtime.
3. QuickJS loads the selected script as an ES module and resolves only `@pocket-tools/sdk` through the native module loader.
4. A runtime-owned context exposes current host state and records requested writes as serializable operations.
5. The host validates and applies those operations in one SQLite transaction scoped to the script manifest ID.
6. React Native renders the returned declarative UI tree.

Adding another example script does not require host-code changes. The generated catalog and generic selector make it available automatically.

## Durable timers

SQLite stores the mini-app ID, timer ID, and UTC start timestamp. The host reconstructs elapsed seconds from the current clock whenever it opens. A running timer does not keep QuickJS or the React Native process alive.

The `liveTimer` property on a money metric lets the native renderer update a calculated value once per second from a durable timer and a script-provided hourly rate. The host does not contain Bathroom Pay-specific calculation logic.

## Current host operations

The current SDK exposes only operations exercised by the first reference script:

- Read declared setting values
- Insert records
- Query records with the current `gte`, order, and limit shape
- Count and sum query results
- Start, read, and stop durable timers
- Render the current page, section, metric, timer, button, summary, list, list-item, and empty-state nodes

These operations are generic and scoped by each mini app's manifest and declared collections.

## QuickJS-NG integration

The local Expo module compiles QuickJS-NG 0.15.1 from a pinned upstream commit with the Android NDK. No WebView, React Native `eval`, or host JavaScript runtime fallback exists.

Each invocation creates and disposes one runtime. Initial enforced bounds are:

- 512 KiB script source
- 2 MiB host request snapshot
- 32 MiB QuickJS heap
- 512 KiB QuickJS stack
- 250 ms execution deadline
- 512 rendered nodes
- 16 levels of UI-tree depth

No GitHub Actions workflow is enabled yet. Repository checks and Android builds are manual until CI is deliberately introduced later. Device-level process-recovery behavior still requires validation on an Android device or emulator.

## Deliberate exclusions

This slice does not add:

- Script installation, paste editing, or deletion
- Persistent installed-mini-app library management
- File, network, notification, location, or secret capabilities
- Schema migration or SDK compatibility layers
- Manual Bathroom Pay trip entry, editing, deletion, exports, or broader summaries
