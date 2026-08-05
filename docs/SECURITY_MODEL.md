# Security Model

## Security objective

A mini-app may compute values and use the documented Pocket Tools SDK without gaining ambient authority over the phone, host application, another tool, or host-owned services.

Every script is untrusted, including scripts produced by an agent, pasted by the device owner, bundled as a reference, restored from backup, or previously installed successfully.

## Trust boundaries

Trusted:

- Signed Pocket Tools host code
- The public SDK 1.0, 1.1, and 1.2 TypeScript contract
- The matching composed QuickJS SDK and runner
- Host-owned React Native, SQLite, clipboard/share, and Android notification services
- Host-selected installed and preview storage namespaces
- Host-owned notification identifiers, channels, pending intents, and reconciliation state

Untrusted:

- Pasted, bundled, installed, preview, rollback, duplicated, exported, and restored mini-app source
- Script manifests and definitions
- Script-generated queries and UI trees
- Script-requested operations, effects, and notification requests
- Script console output and interaction input
- Backup documents supplied by the user

## Core invariants

1. Scripts execute in QuickJS-NG, not the React Native JavaScript runtime.
2. Every inspection, render, and action receives a fresh bounded runtime and context.
3. The module loader resolves only `@pocket-tools/sdk`.
4. Cross-boundary values are finite serializable values made from plain objects and arrays.
5. Native objects and host references never enter the script runtime.
6. Host state is passed as function arguments, not writable globals.
7. SQLite namespaces are selected by trusted host code; scripts cannot provide or discover a storage namespace.
8. Definitions, settings, records, queries, operations, effects, notification requests, targets, and UI trees are validated before use.
9. SQLite independently validates every persisted setting and record value using the inspected manifest version.
10. One action's durable writes are applied in one transaction or not at all.
11. Notification reconciliation and output/feedback effects occur only after the durable transaction commits.
12. Running timers and scheduled notifications do not imply running script code.
13. Runtime, allocation, decoding, validation, persistence, and native failures become structured host errors.
14. Preview state is isolated from installed state under a disposable host-only namespace.
15. Installed source changes only after the exact candidate passes validation and its first isolated native render.
16. Notification taps navigate only to a validated installed screen; they never invoke a mini-app action.

## Public host authority

The SDK exposes only bounded host-owned capabilities:

- Declared isolated settings, including action-only `set` and `reset`
- Declared isolated collection records
- Validated local queries and numeric aggregates
- Durable start/get/stop timers
- Current host time
- Host-owned screen navigation and declarative UI rendering
- One bounded feedback request per action
- One bounded copy or share request per action
- Tool-scoped local notification schedule, cancel, and cancel-all requests

No general permission or capability framework exists. The SDK does not grant arbitrary files, network, location, secrets, sensors, native modules, platform components, background JavaScript, or remote push access.

## Source installation boundary

The installation record is host-owned SQLite data containing manifest metadata, active source, last-known-good source, and timestamps. A script cannot read or modify its installation record.

The on-device editor and local authoring command execute the same composed SDK and runner used by ordinary Android execution. A candidate is not stored as active source merely because its manifest parses. The exact current source must pass inspection and complete a first render in isolated preview before install or update becomes available.

For updates, the host clones installed settings, records, and timers into disposable preview storage. Preview operations can mutate only the clone. Preview notification requests do not acquire authority over an installed tool's registry. Validation, preview, or first-render failure leaves active source and installed state unchanged.

A successful update moves the old active source to last-known-good source while installing the candidate. Rollback validates the saved source before swapping it back. Duplicate copies source into the editor but does not copy state and requires a new manifest ID.

Bundled references are one-time installation seeds, not trusted code and not a privileged execution path.

## Runtime isolation and limits

Each request creates and disposes a new QuickJS runtime and context. Scripts cannot observe globals left by an earlier invocation and do not receive React Native, Expo, Node.js, filesystem, SQLite, process environment, authentication, permission, or Android-service globals.

The module loader rejects external packages, relative and absolute paths, remote URLs, Node modules, re-exports, and dynamic imports outside the virtual SDK module.

Current trusted-host defaults include:

- 512 KiB maximum script source
- 2 MiB maximum host request
- 2 MiB maximum serialized result
- 32 MiB QuickJS heap
- 512 KiB QuickJS stack
- 250 ms execution deadline
- 100 captured console entries
- 64 KiB captured console text
- 512 rendered UI nodes
- 16 levels of UI-tree depth

These are host implementation limits, not script-controlled settings. QuickJS interrupt, memory, stack, job-draining, source, response, log, graph-complexity, node-count, and depth checks fail closed.

Screens and actions are synchronous. Returning a promise or using unsupported asynchronous module behavior fails the invocation. No host wait keeps QuickJS alive for a timer, notification, share sheet, or future callback.

## Bridge and response validation

Allowed bridge values are `null`, finite numbers, strings, booleans, arrays of allowed values, and plain objects with safe string keys and allowed values.

Dates cross as canonical strings. `undefined`, functions, symbols, bigints, cycles, class instances, unsafe prototype keys, non-finite numbers, native handles, and excessively complex graphs are rejected.

QuickJS validates runtime inputs, query use, working-state mutation, requested operations/effects, notification intent, targets, and broad UI structure. React Native then validates the response envelope, logs, inspection definitions, exact operation/effect shapes, exact UI properties, setting bindings, action/screen targets, notification targets, and version gates.

Unknown keys are rejected rather than ignored.

## Settings, data, and transactional isolation

Ordinary execution loads and writes state under the installed manifest ID. Preview uses a reserved host-only ID. A script receives neither value and cannot construct SQL.

Settings are checked against their declared type, options, selection bounds, canonical temporal representation, text bounds, and numeric bounds before persistence and again when loaded. Action-only setting writes are recorded as explicit operations.

Collection fields are required unless optional. Unknown fields, host-owned metadata, invalid types, non-finite values, invalid dates, and bound violations are rejected. Record IDs and timestamps remain host-owned.

Queries are limited to declared collections and fields, documented type-compatible operators, bounded ordering, offset, and limit. Aggregates accept only declared numeric fields. Raw SQL, joins, cross-tool queries, callbacks, predicates, and unbounded expression trees are unavailable.

Insert, update, remove, setting writes, timer changes, and notification-registry changes cross the boundary explicitly. The host validates the complete action result before applying durable operations in list order inside one SQLite transaction. A validation or SQLite failure rolls back the entire action and performs no output or feedback effects.

## UI and interaction validation

Scripts never pass React Native components, arbitrary style objects, event handlers, native props, SVG, image URLs, or icon packages.

The host accepts only documented nodes and exact properties. Settings-bound controls must reference compatible declared settings. Buttons and row actions must reference declared actions. Navigation and notification open targets must reference declared screens. Inputs must be finite and serializable.

The fixed icon vocabulary is mapped to host assets. Icons are decorative; script-provided labels remain the accessibility authority. Host code owns confirmation dialogs, disabled behavior, destructive presentation, large-font layout, TalkBack behavior, and event propagation isolation.

## Timers

Timer IDs are lower-camel-case names scoped by the trusted storage namespace. A timer stores a UTC start timestamp. The host reconstructs elapsed time after relaunch without retaining QuickJS or the React Native process.

The SDK exposes no timer callbacks, pause/resume authority, arbitrary timer metadata, or background JavaScript.

## Feedback, clipboard, and sharing

`context.feedback.show`, `context.output.copy`, and `context.output.share` record bounded post-commit effects. Scripts cannot access toast/snackbar objects, read the clipboard, choose MIME types or files, observe the share result, or receive callbacks.

At most one feedback and one output effect are accepted per action. Effects execute only after durable state commits and the active screen rerenders. Canceling a share sheet cannot undo committed state.

## Local notification authority

SQLite is the authoritative desired-notification registry. Android alarms and posted notifications are derived host state.

A script may only schedule, replace, cancel, or cancel all notifications owned by its installed manifest ID. Requests are validated for stable ID, title/body limits, trigger shape, canonical date-time, recurrence bounds, delivery mode, declared open screen, serializable input, and per-tool schedule limits.

Pocket Tools owns:

- Android notification permission and the reminders channel
- Exact-alarm access checks and guidance
- Host notification and pending-intent identifiers
- Standard and exact AlarmManager scheduling
- Startup, foreground, boot, package-update, clock, timezone, restore, update, and removal reconciliation
- Blocked/failed status and retry
- Tap-routing cache and deep-link validation

Denied notification permission or a disabled channel leaves desired schedules blocked for later reconciliation. Exact reminders are never silently downgraded: an action requiring unavailable exact access fails before SQLite persistence. An exact reminder restored from backup remains exact and blocked until access is granted.

Notification delivery never wakes or retains QuickJS. A tap opens the validated tool screen or a safe fallback and never runs an action. Tools cannot inspect Android permission state, channel state, delivery success, paired watches, or whether Galaxy Wearable mirrored a notification.

## Backup, restore, removal, and recovery

Portable tool and complete-host backup format v2 contain validated desired notification state in addition to source and durable tool data. They exclude Android pending-intent IDs, permission/channel state, reconciliation errors, delivery history, and other device-specific derived state.

Restore validates the complete document and every included source before replacing host state. Notification reconciliation derives fresh Android schedules from committed desired state. Invalid documents or failed durable writes leave the previous installation unchanged.

Removing a tool always removes its desired notifications and cancels derived Android schedules, even when settings, records, and timers are retained for reinstall. A script cannot trigger installation, update, rollback, duplication, export, backup, restore, or removal.

## Console logging and failures

The sandbox provides bounded `console.log`, `console.info`, `console.warn`, and `console.error`. Logs return as diagnostic text only and never write directly to Android services or persisted state.

Machine-readable errors preserve stable categories, bounded script stack and logs, and truncation state. A failed invocation cannot retain global state, partially apply durable operations, perform effects, change active source, or poison the next invocation.

Post-commit Android scheduling or output failures cannot roll back committed SQLite state. The notification registry remains authoritative and recoverable; the host exposes failure status and retries reconciliation later.

## Manual verification

No GitHub Actions workflow is enabled. Run repository and Android validation manually:

```bash
pnpm install
pnpm sdk:declarations
pnpm sync:mini-apps
pnpm format
pnpm check
pnpm --dir apps/mobile exec expo prebuild --platform android --clean --no-install
cd apps/mobile/android
./gradlew :app:assembleDebug connectedDebugAndroidTest --max-workers=4
```

Final SDK 1.2 acceptance additionally proves normal authoring, preview, installation, setting/data transactions, UI, effects, notifications, update, rollback, duplication, export, backup/restore, removal, force-stop recovery, TalkBack, and paired Galaxy Watch notification mirroring.

## Deliberate exclusions

Pocket Tools exposes no:

- General network or remote push access
- Arbitrary file access, attachments, or incoming share intents
- Location, camera, microphone, contacts, health, Bluetooth, or sensor access
- Secret or credential storage
- Custom native modules or arbitrary React Native components
- Script-defined notification channels, sounds, images, actions, or Do Not Disturb bypass
- Background QuickJS, workers, callbacks, or exact background task execution
- Dedicated Wear OS app, tiles, complications, watch targeting, or watch-native actions
- Cloud synchronization, accounts, remote installation, or public distribution authority

Future capability expansion requires another explicit SDK contract and full host-boundary review.
