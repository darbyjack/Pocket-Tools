# Pocket Tools Offline Mini-App SDK

Pocket Tools supports manifest versions `"1.0"`, `"1.1"`, and `"1.2"`. SDK 1.2 is the current public version.

New tools should declare the lowest version whose features they use. Unknown versions and higher-version fields under a lower manifest version are rejected before installation. Legacy numeric `sdkVersion: 1` is normalized only to SDK 1.0 for already-installed source.

## Authority

The public contract is implemented across:

- `packages/sdk-contract/src/`
- generated declarations in `packages/sdk-contract/dist/`
- the composed local authoring runtime
- the embedded QuickJS SDK and runner
- React Native protocol and UI validation
- host-owned SQLite persistence
- Android output and notification services
- examples, templates, and acceptance fixtures

The complete normative SDK 1.2 surface is defined in [SDK_1_2_CONTRACT.md](SDK_1_2_CONTRACT.md).

## Execution model

A mini-app is one synchronous JavaScript ES module. It imports only `@pocket-tools/sdk`, default-exports one `defineMiniApp(...)` result, and executes inside a fresh bounded QuickJS-NG runtime for each inspection, render, or action.

Scripts return declarative UI and explicit operations or effects. The host validates every boundary and owns:

- native rendering and accessibility
- storage namespaces and SQLite transactions
- navigation and interaction dispatch
- durable timer timestamps
- feedback, clipboard writes, and Android sharing
- local notification permission, channels, alarms, reconciliation, and tap routing
- installation, preview, update, rollback, backup, restore, and removal

No script receives a native object, database handle, filesystem path, network client, permission object, React Native component, or long-lived background runtime.

## SDK 1.0

SDK 1.0 is the original frozen offline surface:

- text, boolean, number, money, and select settings
- text, boolean, number, money, and compatible date-time collection fields
- isolated record insert, get, update, remove, query, count, and sum
- equality and bounded range filters, ordering, limit, and offset
- synchronous screens and actions
- finite serializable route and action input
- host-owned navigation and native UI
- durable start/get/stop timers
- host formatting for plain text, numbers, USD money, and durations

## SDK 1.1

SDK 1.1 adds host-owned action presentation while preserving SDK 1.0 behavior:

- reusable `ui.action(...)` descriptors
- visible list-item actions
- disabled controls
- destructive intent
- host confirmation metadata

Scripts do not receive alert callbacks or native presentation objects.

## SDK 1.2

SDK 1.2 adds the complete released surface below.

### Data and settings

- action-only transactional `settings.set(...)` and `settings.reset(...)`
- canonical date and UTC date-time settings, fields, and native inputs
- bounded ordered multi-select settings and input
- query operators `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `contains`, and `startsWith` where compatible with the declared field type
- numeric `sum`, `min`, `max`, and `average` aggregates
- same-action reads over the action's validated working state

See [SDK 1.2 Data and Settings](SDK_1_2_DATA_AND_SETTINGS.md).

### UI and output

- tappable list-row primary actions
- multiline text input and numeric input hints
- badges and range-aware progress
- fixed semantic host icons
- one bounded feedback effect per action
- one bounded copy or share effect per action

See [SDK 1.2 UI and Output](SDK_1_2_UI_AND_OUTPUT.md).

### Local notifications

- immediate, date, daily, and weekly triggers
- standard and exact delivery intent
- stable tool-scoped schedule IDs
- validated screen routing with finite serializable input
- host-owned permission, channels, scheduling, recovery, reconciliation, and cleanup

Exact delivery is never silently downgraded. See [SDK 1.2 Notifications](SDK_1_2_NOTIFICATIONS.md).

## Compatibility

A 1.2 host preserves existing 1.0 and 1.1 behavior:

- lower-version scripts do not gain 1.2 authority implicitly
- 1.2-only definitions, UI, operations, effects, and notification requests fail under 1.0 or 1.1
- legacy SDK 1.0 date-time compatibility remains isolated from canonical SDK 1.2 temporal validation
- existing settings, records, timers, updates, rollbacks, and backups remain supported
- the manifest ID remains the permanent installed state namespace

## Deliberate exclusions

The public SDK does not include:

- arbitrary network, filesystem, location, secrets, sensors, or remote push
- external packages, dynamic imports, Node.js, React, React Native, Expo, JSX, or HTML
- custom native modules, platform components, styles, images, or icons
- raw SQLite, host handles, permission manifests, or Android service access
- arbitrary background JavaScript, workers, timers, promises, or callbacks
- script-defined notification channels, sounds, actions, or delivery callbacks
- clipboard reads, file sharing, or share-result observation

Documented `context.output`, `context.feedback`, and `context.notifications` are narrow host-owned clients, not ambient platform access.

## Authoritative references

- [SDK 1.2 Agent Authoring Guide](AGENT_AUTHORING.md)
- [Canonical Agent Prompt](AGENT_PROMPT.md)
- [SDK 1.2 Contract](SDK_1_2_CONTRACT.md)
- [Generated declarations](../packages/sdk-contract/dist/index.d.ts)
- [Authoring Error Codes](AUTHORING_ERRORS.md)
- [Architecture](ARCHITECTURE.md)
- [Security Model](SECURITY_MODEL.md)
