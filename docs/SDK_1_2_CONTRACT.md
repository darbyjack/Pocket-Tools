# Pocket Tools SDK 1.2 Contract

## Status

This document freezes the public SDK 1.2 design before implementation begins.

SDK 1.2 is **not yet supported**. Until the activation slice is complete:

- `SDK_VERSION` remains `"1.1"`.
- `SUPPORTED_SDK_VERSIONS` remains `"1.0"` and `"1.1"`.
- A manifest declaring `sdkVersion: "1.2"` remains invalid.
- Generated declarations and the embedded QuickJS module must not expose incomplete 1.2 APIs.

Implementation may land in focused internal slices, but the host must advertise SDK 1.2 only after every required capability in this contract is implemented, documented, and covered by compatibility and physical Android acceptance.

SDK 1.0 and 1.1 behavior remains frozen. A script must continue to declare the lowest SDK version whose features it uses.

## Design principles

- Scripts remain synchronous and execute only inside bounded QuickJS-NG runtimes.
- Every public capability is declarative or records a host-owned operation or effect.
- Scripts receive no native objects, callbacks, promises, database handles, Android services, or arbitrary React Native components.
- Persistent changes remain isolated by the installed manifest ID.
- Action mutations are validated completely before one SQLite transaction begins.
- Android side effects occur only after the durable transaction commits.
- Network access, arbitrary filesystem access, location, secrets, remote push, custom native modules, and arbitrary background JavaScript remain unavailable.
- Local notification delivery never wakes or retains QuickJS.

# Version and capability gating

SDK 1.2 introduces new definition fields, UI nodes, context clients, operations, and effects. Every 1.2-only shape is rejected for manifests declaring 1.0 or 1.1.

The final activation slice must:

```ts
export const SDK_VERSION = "1.2" as const;
export const SUPPORTED_SDK_VERSIONS = ["1.0", "1.1", SDK_VERSION] as const;
```

Legacy numeric `sdkVersion: 1` continues to normalize only to SDK 1.0.

The implementation must apply version checks at all relevant boundaries:

- definition validation
- embedded SDK builders
- inspection protocol
- UI-tree validation
- action-operation and effect validation
- local authoring validation and inspection
- generated declarations
- Android host parsing

# Action execution model

## Runtime result

SDK 1.2 action execution returns durable operations and optional post-commit effects:

```ts
interface RuntimeValue {
  readonly inspection?: MiniAppInspection;
  readonly page?: PageNode;
  readonly operations: readonly RuntimeOperation[];
  readonly effects?: readonly RuntimeEffect[];
}
```

SDK 1.0 and 1.1 responses continue to work with no `effects` member. The host treats an omitted effect list as empty.

## Transaction and effect order

For one action invocation, the host performs this exact sequence:

1. Load one validated snapshot of settings, records, timers, and notification schedules.
2. Execute the synchronous action in a fresh bounded QuickJS runtime.
3. Validate the complete operation list and effect list, including SDK-version gates and external preconditions that must fail atomically.
4. Apply every durable operation in list order inside one SQLite transaction.
5. Commit or roll back the complete transaction.
6. Reconcile the committed notification registry with Android scheduling.
7. Reload and rerender the active screen from committed state.
8. Perform at most one output effect.
9. Display at most one feedback effect.

A validation or SQLite failure persists nothing and performs no effects.

A post-commit Android or output failure cannot roll back already committed SQLite state. Notification reconciliation failures remain recoverable from the authoritative registry and are retried at the next reconciliation point. Other post-commit failures are shown through a host-owned error message.

## In-action working state

Clients that mutate durable state also update the QuickJS working snapshot. Subsequent reads in the same action observe prior successful calls in list order.

Examples:

- `settings.set("name", "A")` followed by `settings.get("name")` returns `"A"`.
- `settings.reset("name")` followed by `settings.get("name")` returns the declared default.
- Query and aggregate calls observe prior inserts, updates, and removals made in the same action.
- Notification replacement and cancellation calls observe prior schedule calls in the same action.

Write methods are valid only during action execution. Calling one during inspection or screen rendering fails the invocation and produces no operations.

Existing action-operation limits remain authoritative, and all new durable operations count toward the same limit. SDK 1.2 adds at most two effects per action: one output effect and one feedback effect.

# 1. Transactional setting writes

## Public surface

```ts
interface SettingsClient {
  get<TValue extends SerializableValue = SerializableValue>(name: string): TValue;
  set(name: string, value: SerializableValue): void;
  reset(name: string): void;
}
```

## Serialized operations

```ts
interface SettingSetOperation {
  readonly type: "setting-set";
  readonly setting: string;
  readonly value: SerializableValue;
}

interface SettingResetOperation {
  readonly type: "setting-reset";
  readonly setting: string;
}
```

## Behavior

- `set` and `reset` require an SDK 1.2 manifest.
- The setting name must be a declared lower-camel-case setting in the current tool.
- `set` validates the value against the full declared setting schema before recording the operation.
- `reset` writes the declared default value; it does not delete the row.
- Both operations participate in the same transaction as collection, timer, and notification operations.
- Multiple writes to the same setting apply in action order.
- Screens continue to update settings through host-owned input controls. The new methods exist for action-driven form clearing and derived updates.

# 2. Date and date-time values

## Canonical representations

- Date-only values are strings in exact `YYYY-MM-DD` form.
- Date-time values are canonical UTC ISO strings in exact `YYYY-MM-DDTHH:mm:ss.sssZ` form.
- Invalid calendar dates and invalid date-time instants are rejected.
- Date-only values never receive timezone conversion.
- Native date-time controls display in the device timezone and persist the selected instant in UTC.

## Settings

```ts
interface DateSetting extends SettingBase<"date", string> {
  readonly min?: string;
  readonly max?: string;
}

interface DateTimeSetting extends SettingBase<"datetime", string> {
  readonly min?: string;
  readonly max?: string;
}
```

Builders:

```ts
setting.date(definition);
setting.datetime(definition);
```

The default, minimum, and maximum use the canonical representation for their type. Ordered bounds are required.

## Collection fields

```ts
interface DateField extends FieldBase<"date"> {
  readonly min?: string;
  readonly max?: string;
}

interface DateTimeField extends FieldBase<"datetime"> {
  readonly min?: string;
  readonly max?: string;
}
```

Builders:

```ts
field.date(definition?)
field.datetime(definition?)
```

The existing datetime field remains source-compatible while gaining optional validated bounds for SDK 1.2 definitions.

## Native inputs

```ts
interface DateInputNode extends SettingInputNode<"date-input"> {}
interface DateTimeInputNode extends SettingInputNode<"datetime-input"> {}

ui.dateInput(definition);
ui.datetimeInput(definition);
```

- A date input binds only to a declared date setting.
- A date-time input binds only to a declared date-time setting.
- Android pickers are entirely host-owned.
- Canceling a picker changes no setting.
- Confirming a picker applies the same setting validation path as every other host setting update.

## Query behavior

Date and date-time fields support `eq`, `neq`, `gt`, `gte`, `lt`, and `lte`. Comparisons use canonical chronological ordering.

# 3. Tappable list rows

## Public surface

```ts
interface ListItemNode extends UiNodeBase<"list-item"> {
  readonly title: string;
  readonly subtitle?: string;
  readonly trailing?: string;
  readonly leadingIcon?: UiIconName;
  readonly primaryAction?: ActionControl;
  readonly actions?: readonly ActionControl[];
}
```

## Behavior

- `primaryAction` requires SDK 1.2.
- The full row becomes one host-owned press target.
- `primaryAction.label` is required and becomes the accessibility action label; it is not rendered as another button.
- The action target must be declared and its input must be finite and serializable.
- `disabled` disables row invocation and applies disabled presentation.
- Confirmation remains host-owned.
- A primary action with `intent: "destructive"` must also declare confirmation.
- The existing limit of one to three visible list-item actions remains unchanged.
- The row action is separate from the visible-action count.
- Pressing a visible action must not also invoke the row action.

# 4. Everyday queries and aggregates

## Query operators

```ts
type QueryOperator = "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "contains" | "startsWith";
```

## Type matrix

- Text: `eq`, `neq`, `contains`, `startsWith`.
- Boolean: `eq`, `neq`.
- Number and money: `eq`, `neq`, `gt`, `gte`, `lt`, `lte`.
- Date and date-time: `eq`, `neq`, `gt`, `gte`, `lt`, `lte`.

`contains` and `startsWith` are case-insensitive Unicode text comparisons. They do not accept regular expressions or locale options.

All filters remain AND-combined. Raw SQL, joins, arbitrary predicates, cross-tool queries, and unbounded expression trees remain unavailable.

## Aggregates

```ts
interface CollectionClient {
  count(query?: CollectionQuery): number;
  sum(fieldName: string, query?: CollectionQuery): number;
  min(fieldName: string, query?: CollectionQuery): number | null;
  max(fieldName: string, query?: CollectionQuery): number | null;
  average(fieldName: string, query?: CollectionQuery): number | null;
}
```

- `sum`, `min`, `max`, and `average` accept only declared number or money fields.
- Optional or missing values are skipped.
- `sum` returns `0` for no matching numeric values, preserving existing behavior.
- `min`, `max`, and `average` return `null` for no matching numeric values.
- All results must be finite.
- Queries and aggregates observe prior collection mutations made in the same action.

# 5. Host-owned feedback

## Public surface

```ts
interface FeedbackClient {
  show(message: string): void;
}
```

`MiniAppContext` gains:

```ts
readonly feedback: FeedbackClient;
```

## Serialized effect

```ts
interface FeedbackEffect {
  readonly type: "feedback";
  readonly message: string;
}
```

## Behavior

- Feedback requires SDK 1.2.
- The message must contain 1 to 160 characters of plain text.
- An action may record at most one feedback effect.
- A second call fails the action before persistence.
- Feedback appears only after the durable transaction commits and the active screen rerenders.
- The host chooses snackbar or toast presentation.
- Scripts cannot choose color, position, duration, markup, icon, callbacks, or accessibility behavior.

# 6. Copy and share output

## Public surface

```ts
interface OutputClient {
  copy(text: string): void;
  share(request: { readonly title?: string; readonly text: string }): void;
}
```

`MiniAppContext` gains:

```ts
readonly output: OutputClient;
```

## Serialized effects

```ts
interface CopyEffect {
  readonly type: "copy";
  readonly text: string;
}

interface ShareEffect {
  readonly type: "share";
  readonly title?: string;
  readonly text: string;
}
```

## Behavior

- Output requires SDK 1.2.
- An action may record at most one output effect: copy or share.
- A second output request fails the action before persistence.
- Text must contain 1 to 10,000 characters.
- A share title, when present, must contain 1 to 120 characters.
- Copy is write-only. Scripts cannot inspect clipboard contents.
- Share uses the host-owned Android share sheet.
- No files, attachments, file paths, MIME selection, incoming-share handling, or clipboard reads are exposed.
- Output occurs after commit and rerender. Canceling the Android share sheet does not undo committed state.

# 7. Local notifications and reminders

## Public surface

```ts
interface NotificationOpenTarget {
  readonly screen: string;
  readonly input?: SerializableValue;
}

type NotificationTrigger =
  | { readonly type: "immediate" }
  | {
      readonly type: "date";
      readonly at: string;
      readonly delivery?: "standard" | "exact";
    }
  | {
      readonly type: "daily";
      readonly hour: number;
      readonly minute: number;
      readonly delivery?: "standard" | "exact";
    }
  | {
      readonly type: "weekly";
      readonly weekday: 1 | 2 | 3 | 4 | 5 | 6 | 7;
      readonly hour: number;
      readonly minute: number;
      readonly delivery?: "standard" | "exact";
    };

interface NotificationRequest {
  readonly id: string;
  readonly title: string;
  readonly body?: string;
  readonly trigger: NotificationTrigger;
  readonly open?: NotificationOpenTarget;
}

interface NotificationClient {
  schedule(request: NotificationRequest): void;
  cancel(id: string): void;
  cancelAll(): void;
}
```

`MiniAppContext` gains:

```ts
readonly notifications: NotificationClient;
```

Weekdays use ISO numbering: Monday is `1` and Sunday is `7`.

## Serialized operations

```ts
interface NotificationScheduleOperation {
  readonly type: "notification-schedule";
  readonly request: NotificationRequest;
}

interface NotificationCancelOperation {
  readonly type: "notification-cancel";
  readonly notificationId: string;
}

interface NotificationCancelAllOperation {
  readonly type: "notification-cancel-all";
}
```

## Identity and limits

- Notification methods require SDK 1.2.
- A notification ID is a lower-camel-case identifier from 1 to 80 characters.
- Android identifiers are derived from both manifest ID and notification ID. Scripts never receive or choose the host identifier.
- A tool may own at most 64 desired schedules.
- Reusing an ID replaces that tool's existing schedule.
- One tool cannot inspect, replace, or cancel another tool's schedules.
- Title length is 1 to 80 characters.
- Body length is 0 to 240 characters.
- An open target must name a declared screen and use finite serializable input.

## Trigger semantics

- `immediate` requests delivery as soon as Android permits after commit.
- `date.at` must be a future canonical UTC ISO date-time.
- Daily and weekly triggers use the device's current local timezone and follow daylight-saving changes.
- Hour is an integer from 0 to 23.
- Minute is an integer from 0 to 59.
- Omitted `delivery` means `"standard"`.
- Standard delivery may be delayed by Android battery and scheduling policy.
- Exact delivery requires Android Alarms & reminders special access where applicable.
- When an exact request cannot be scheduled because special access is unavailable, the action fails before SQLite persistence with `NOTIFICATION_EXACT_PERMISSION_REQUIRED`. The host must not silently downgrade it to standard delivery.

## Permission behavior

Mini apps cannot request Android notification or exact-alarm permissions.

Pocket Tools owns:

- the Android notification permission flow
- notification channels
- exact-alarm guidance
- global notification settings
- per-tool notification controls
- permission and channel status display

A standard schedule may be stored while notification permission or a channel is disabled. It remains visible as blocked in Pocket Tools and is reconciled when permission becomes available. This does not count as successful device delivery.

## Authoritative registry

Pocket Tools stores the desired notification registry in SQLite. Android schedules are a derived cache, not the source of truth.

The host reconciles the registry:

- after every committed notification operation
- at application startup
- after application update
- after permission or channel changes detected by the host
- after backup restore
- after device boot through the supported Android scheduling path

A scheduling failure leaves the desired row intact with host-owned reconciliation status. The host retries later and exposes the blocked or failed state to the user.

Expired one-time schedules are removed from the desired registry during reconciliation after their scheduled instant has passed.

## Removal and retained data

Removing a tool always deletes its desired notification schedules and cancels derived Android schedules, whether other tool data is retained or deleted.

This prevents orphan reminders from a tool that is no longer installed. Reinstalling the same manifest ID does not reactivate old reminders. A portable backup may restore them explicitly.

## Tap routing

A notification tap opens Pocket Tools and routes to the installed manifest ID associated with the host notification identifier.

- With an `open` target, the host opens the declared screen with its validated input.
- Without an `open` target, the host opens the tool's home screen.
- If the tool is no longer installed, Pocket Tools opens the library and shows a concise unavailable-tool message.
- Notification taps never invoke a mini-app action directly.

## Galaxy Watch4 Classic

SDK 1.2 has no watch-targeting field. Pocket Tools creates an ordinary Android notification on the paired phone.

Wear OS and Samsung Galaxy Wearable may bridge that notification to a paired Galaxy Watch4 Classic when:

- Pocket Tools notifications are enabled for the watch
- the watch is connected
- notification permission and channels are enabled
- Do Not Disturb, sleep, and other system policies permit delivery

All mini apps appear to Android and Galaxy Wearable as the single Pocket Tools application. Per-tool controls therefore live inside Pocket Tools.

Watch display is not guaranteed, and no script can detect the watch, request watch delivery, or determine whether a watch displayed the alert.

A dedicated Wear OS application, tiles, complications, standalone watch operation, and watch-native action execution remain outside SDK 1.2.

## Notification exclusions

SDK 1.2 does not provide:

- remote push notifications
- network access
- custom sounds
- arbitrary vibration patterns
- critical alerts or Do Not Disturb bypass
- script-defined channels
- notification images
- notification-shade or watch action handlers
- background QuickJS execution
- direct or guaranteed watch delivery

# 8. Smaller form and UI additions

## Multiline text input

```ts
interface TextInputNode extends SettingInputNode<"text-input"> {
  readonly placeholder?: string;
  readonly multiline?: boolean;
  readonly minLines?: 2 | 3 | 4 | 5 | 6 | 7 | 8;
}
```

- `minLines` requires `multiline: true`.
- Multiline remains bound to a declared text setting.
- Text length remains controlled by the setting definition.

## Numeric input hints

```ts
interface NumberInputNode extends SettingInputNode<"number-input"> {
  readonly step?: number;
  readonly decimalPlaces?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
}
```

- `step` must be finite and greater than zero.
- These values guide host input behavior and display only.
- Final stored values must still satisfy the setting schema.
- They do not alter query or arithmetic semantics.

## Multi-select settings

```ts
interface MultiSelectSetting extends SettingBase<"multi-select", readonly SelectValue[]> {
  readonly options: readonly SelectOption[];
  readonly minSelections?: number;
  readonly maxSelections?: number;
}

interface MultiSelectInputNode extends SettingInputNode<"multi-select"> {}

setting.multiSelect(definition);
ui.multiSelect(definition);
```

- Defaults contain unique option values only.
- Options remain limited to 1 through 100 entries.
- Selection bounds are integers within the option count and must be ordered.
- Stored arrays preserve option declaration order, not tap order.
- Multi-select settings cannot be referenced by SDK 1.2 `visibleWhen`; visibility comparisons remain scalar.

## Badges

```ts
type BadgeTone = "neutral" | "info" | "success" | "warning" | "danger";

interface BadgeNode extends UiNodeBase<"badge"> {
  readonly text: string;
  readonly tone?: BadgeTone;
}

ui.badge(definition);
```

Text length is 1 to 80 characters. Tone is semantic and host-owned; scripts cannot provide colors.

## Progress

```ts
interface ProgressNode extends UiNodeBase<"progress"> {
  readonly label?: string;
  readonly value: number;
  readonly min?: number;
  readonly max?: number;
  readonly format?: "number" | "percent";
}

ui.progress(definition);
```

- Values and bounds must be finite.
- Default minimum is `0` and default maximum is `100`.
- Maximum must exceed minimum.
- The host clamps visual presentation to the range but validation preserves the original finite value for accessibility text.
- A percent format describes progress through the declared range; it does not require a 0-to-100 input.

## Fixed host icons

```ts
type UiIconName =
  | "add"
  | "edit"
  | "delete"
  | "check"
  | "calendar"
  | "clock"
  | "copy"
  | "share"
  | "search"
  | "settings"
  | "warning"
  | "info"
  | "money"
  | "list"
  | "refresh";
```

SDK 1.2 adds:

- `icon?: UiIconName` to `ActionControl`
- `leadingIcon?: UiIconName` to `ListItemNode`

Icons are host-owned and decorative. Text labels remain mandatory for every action and accessibility path. Scripts cannot provide SVG, image URLs, icon packages, colors, or sizes.

# Backup format decision

Notification schedules change portable state. The implementation must create explicit backup format version 2 for both:

- `pocket-tools-mini-app`
- `pocket-tools-host`

Version 2 adds the tool's validated desired notification schedules.

Following the project's pre-release no-compatibility rule, the version-2 restore path is not required to accept version-1 documents. The implementation PR must update export, restore, validation, documentation, malformed-input tests, and device acceptance together. No reader may silently infer missing notification state.

Settings, date values, multi-select values, and other SDK data continue to use the existing serializable setting and record containers and do not independently require another backup field.

# Stable error categories

Implementation must preserve existing error codes and add stable categories for SDK 1.2 failures:

- `VALIDATION_FAILED` for invalid definitions, values, UI, targets, query types, and operation payloads.
- `UNSUPPORTED_SDK_VERSION` where the current host cannot accept the manifest capability version.
- `INVALID_CONTEXT_OPERATION` for write methods called during inspection or rendering.
- `ACTION_LIMIT_EXCEEDED` for operation or effect count limits.
- `NOTIFICATION_EXACT_PERMISSION_REQUIRED` for unavailable exact-alarm access.
- `NOTIFICATION_LIMIT_EXCEEDED` for more than 64 desired schedules.
- `NOTIFICATION_RECONCILIATION_FAILED` for a host-visible post-commit Android scheduling failure; committed desired state remains available for retry.
- `OUTPUT_FAILED` for a host-visible post-commit clipboard or share failure.

Exact message text may be refined during implementation, but category meanings must not change after SDK 1.2 activation.

# Compatibility and acceptance matrix

## SDK 1.0

- Continues to accept only the original definition and UI surface.
- Cannot use action controls, primary list actions, new setting types, new context clients, new query operators, new aggregates, or notifications.
- Existing scripts install, render, mutate state, back up, restore, and recover unchanged.

## SDK 1.1

- Retains actionable list-item controls, destructive intent, disabled state, and host confirmation.
- Cannot use any SDK 1.2-only definition field, UI field, client method, operation, or effect.
- Existing scripts install and run unchanged.

## SDK 1.2

- Receives the complete surface in this contract.
- Unknown properties and unsupported enum values remain rejected.
- Malformed operation and effect payloads remain rejected before persistence.

## Required automated coverage

- capability-version acceptance and rejection
- declaration-package compile smoke coverage
- definition and UI exact-key validation
- setting write/reset schema validation and rollback
- in-action working-state behavior
- date and date-time canonical validation
- list-row target, accessibility, disabled, confirmation, and propagation behavior
- query operator type matrix and aggregates
- feedback and output limits and post-commit ordering
- notification ID, trigger, recurrence, target, limit, permission, and removal behavior
- notification registry reconciliation and retry
- backup version-2 parser, round trip, replacement, and malformed documents
- SDK 1.0 and 1.1 fixtures through the same host
- embedded SDK, native source, local authoring tool, and generated declaration drift checks

## Required physical Android acceptance

- native date and date-time pickers
- multiline and numeric input behavior
- tappable rows and visible action isolation
- copy and Android sharing
- feedback presentation after commit only
- notification permission enable, denial, and later enablement
- one-time, daily, and weekly standard reminders
- exact reminder denial and success after granting special access
- notification replacement and cancellation
- tap routing to a declared screen and input
- force-stop, application restart, and device restart reconciliation
- tool removal cancellation
- single-tool and complete-host backup/restore of schedules
- mirrored phone notification delivery to the paired Galaxy Watch4 Classic when enabled in Galaxy Wearable
- SDK 1.0 and 1.1 scripts running on the same build

# Implementation order

1. Transactional setting writes and resets.
2. Date and date-time definitions, values, inputs, and queries.
3. Tappable list-row primary actions.
4. Query operators and aggregates.
5. Feedback effects.
6. Copy and share output effects.
7. Notification registry schema and durable operations.
8. Android local scheduling, permission, channels, reconciliation, and tap routing.
9. Backup format version 2 and notification removal semantics.
10. Smaller form and UI additions.
11. Complete SDK 1.2 activation, declarations, authoring documentation, compatibility, and physical acceptance.

Each implementation slice must keep `sdkVersion: "1.2"` disabled until the final activation slice. A slice may add internal models and tests, but it must not expose an API that an agent can use before the complete advertised contract exists.

# Deliberate exclusions

- cloud synchronization or accounts
- remote backup or remote script installation
- network requests or remote push
- arbitrary file access or attachments
- incoming share intents
- location, camera, microphone, contacts, or health data
- secrets or credential storage
- custom native modules
- arbitrary React Native components or styling
- background QuickJS or exact background task execution
- dedicated Wear OS app, tiles, or complications
- direct watch targeting or watch-native actions
- compatibility aliases, deprecated APIs, or implicit SDK expansion
