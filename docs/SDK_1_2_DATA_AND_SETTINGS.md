# SDK 1.2 Data and Settings

This document is a focused author reference for the released SDK 1.2 data surface. The normative definitions and limits remain in the [SDK 1.2 Contract](SDK_1_2_CONTRACT.md) and generated declarations.

## Transactional setting writes

`context.settings.set(name, value)` and `context.settings.reset(name)` are available only during action execution.

The runtime validates the declared setting and updates the action's working snapshot immediately. Later reads in the same action observe the successful write. The host then revalidates the emitted operations and commits setting, record, timer, and notification-registry changes together in one SQLite transaction.

A validation or persistence failure rolls back the complete action and performs no output or feedback effects. SDK 1.0 and 1.1 contexts do not expose setting writes.

```js
actions: {
  save(context) {
    context.settings.set("title", "Saved");
    context.settings.reset("temporaryFilter");
  },
}
```

## Date and date-time values

Date values use exact Gregorian `YYYY-MM-DD` strings. Date-time values use exact UTC `YYYY-MM-DDTHH:mm:ss.sssZ` strings.

```js
dueDate: setting.date({
  label: "Due date",
  default: "2026-08-04",
  min: "2026-01-01",
  max: "2026-12-31",
}),

reminderAt: setting.datetime({
  label: "Reminder",
  default: "2026-08-04T23:30:00.000Z",
}),
```

SDK 1.2 provides `setting.date`, `setting.datetime`, `field.date`, bounded canonical `field.datetime`, `ui.dateInput`, and `ui.datetimeInput`.

The Android host displays date-time values in the device timezone but persists canonical UTC. Date-only values preserve calendar identity without timezone conversion. Canceling a native picker changes no setting.

SDK 1.0 and 1.1 retain their existing date-time field compatibility behavior; they cannot use the new date settings, date field, or native temporal input nodes.

## Multi-select

A multi-select value is an array of declared option values.

```js
tags: setting.multiSelect({
  label: "Tags",
  options: [
    { label: "Work", value: "work" },
    { label: "Personal", value: "personal" },
  ],
  default: ["work"],
  minSelections: 1,
  maxSelections: 2,
}),
```

Values must:

- contain only declared option values
- contain no duplicates
- follow declaration order
- satisfy optional selection bounds

Multi-select settings cannot drive scalar `visibleWhen` equality.

## Collections and working state

SDK 1.2 collection fields are `text`, `boolean`, `number`, `money`, `date`, and `datetime`. Fields are required unless `optional: true`.

Within one action, queries and aggregates observe prior successful inserts, updates, removals, and setting writes in operation order. Screens may read but cannot mutate durable state.

The host owns record IDs and `createdAt`/`updatedAt` timestamps.

## Queries

Queries accept bounded `where`, `orderBy`, `limit`, and `offset` values.

Supported operators are:

- equality: `eq`, `neq`
- order comparisons: `gt`, `gte`, `lt`, `lte`
- text matching: `contains`, `startsWith`

The validator permits only operators compatible with the declared field type. Query values must use the canonical representation for date and date-time fields. Raw SQL, joins, arbitrary predicates, callbacks, and cross-tool queries do not exist.

```js
const openReports = entries.query({
  where: [
    { field: "complete", operator: "eq", value: false },
    { field: "title", operator: "contains", value: "report" },
  ],
  orderBy: [{ field: "createdAt", direction: "desc" }],
  limit: 20,
});
```

## Aggregates

Collections provide:

```js
entries.count(query);
entries.sum("amount", query);
entries.min("amount", query);
entries.max("amount", query);
entries.average("amount", query);
```

Numeric aggregates accept declared number or money fields only. Empty `min`, `max`, and `average` results are `null`.

## Validation boundary

The same values are independently checked by the executable SDK and trusted host:

- exact definition keys and manifest-version gates
- canonical temporal strings and bounds
- multi-select membership, order, uniqueness, and bounds
- declared collection and field names
- type-compatible query operators
- finite numbers and serializable bridge values
- action-only mutation authority
- operation count and graph-complexity limits

Unknown properties are rejected rather than ignored.
