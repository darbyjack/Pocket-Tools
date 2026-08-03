# First Android Bathroom Pay Slice

## End-to-end path

The bundled `examples/bathroom-pay.miniapp.js` remains the only Bathroom Pay business-logic source. `scripts/sync-example-source.mjs` generates a string module consumed by the Expo application and fails checks when that generated copy is stale.

For each inspection, render, or action request:

1. React Native loads current settings, records, and active timers from Expo SQLite.
2. The native Expo module creates a fresh bounded QuickJS-NG runtime.
3. QuickJS loads the script as an ES module and resolves only `@pocket-tools/sdk` through the native module loader.
4. A runtime-owned context exposes current host state and records requested writes as serializable operations.
5. The host validates and applies those operations in one SQLite transaction.
6. React Native renders the returned declarative UI tree.

Bathroom Pay is not imported or reimplemented as React Native code.

## Durable timers

SQLite stores the timer ID and UTC start timestamp. The app reconstructs elapsed seconds from the current host clock whenever it opens. A running timer does not keep QuickJS or the React Native process alive.

The `liveTimer` property on a money metric lets the native renderer update gross earnings once per second from the durable timer and current hourly rate. This avoids re-running the untrusted script every second.

## Current host operations

Only operations used by Bathroom Pay exist:

- Read declared setting values
- Insert records
- Query records with the current `gte`, order, and limit shape
- Count and sum query results
- Start, read, and stop durable timers
- Render the current page, section, metric, timer, button, summary, list, list-item, and empty-state nodes

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

The pull request remains a draft until the Android build and interruption behavior are exercised on the target device or self-hosted Android runner.

## Deliberate exclusions

This slice does not add:

- Script installation or editing
- Multiple installed mini apps
- File, network, notification, location, or secret capabilities
- Schema migration or SDK compatibility layers
- Manual trip entry, editing, deletion, exports, or broader summaries
