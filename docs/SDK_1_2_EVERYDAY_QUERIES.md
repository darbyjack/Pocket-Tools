# SDK 1.2 Everyday Queries and Aggregates

## Status

This is the fourth internal implementation slice of the frozen [SDK 1.2 contract](SDK_1_2_CONTRACT.md).

The slice implements the complete everyday query operator matrix and numeric aggregate behavior, but it does **not** activate SDK 1.2:

- `SDK_VERSION` remains `"1.1"`.
- `SUPPORTED_SDK_VERSIONS` remains `"1.0"` and `"1.1"`.
- Public SDK TypeScript sources and generated declarations remain unchanged.
- Ordinary inspection, preview, installation, and authoring still reject `sdkVersion: "1.2"`.

## Runtime layering

The established embedded runner remains the authoritative implementation for SDK 1.0 and 1.1.

Android now compiles a small SDK 1.2 runner wrapper that:

1. Leaves definitions below SDK 1.2 untouched.
2. Preserves malformed definitions so the base runner still rejects them normally.
3. Wraps valid SDK 1.2 screen and action functions only.
4. Replaces only `context.data.collection(...)` with a host-owned enhanced collection client.
5. Delegates inserts, reads, updates, and removals to the established collection client.
6. Builds queries and aggregates from the base client's current working record snapshot.

This design preserves all existing storage, mutation, operation, timer, setting, UI, and error behavior. It also ensures queries and aggregates observe prior collection mutations in the same synchronous action.

## Query operator matrix

Dormant SDK 1.2 collection queries support:

| Field type         | Operators                             |
| ------------------ | ------------------------------------- |
| Text               | `eq`, `neq`, `contains`, `startsWith` |
| Boolean            | `eq`, `neq`                           |
| Number and money   | `eq`, `neq`, `gt`, `gte`, `lt`, `lte` |
| Date and date-time | `eq`, `neq`, `gt`, `gte`, `lt`, `lte` |

Text `contains` and `startsWith`:

- use JavaScript Unicode-aware `toLowerCase()` on both operands
- are case-insensitive
- do not accept locale configuration
- do not use regular expressions
- do not expose arbitrary predicates

Text `eq` and `neq` remain exact comparisons.

Date and date-time query values retain the canonical validation introduced by the date-data slice:

- date: exact real-calendar `YYYY-MM-DD`
- date-time: exact UTC `YYYY-MM-DDTHH:mm:ss.sssZ`

All filters remain AND-combined. Ordering, offset, and limit behavior remains unchanged.

## Aggregate behavior

Dormant SDK 1.2 collection clients add:

```js
collection.min(fieldName, query);
collection.max(fieldName, query);
collection.average(fieldName, query);
```

Existing `sum(...)` is routed through the same numeric-value path.

Rules:

- `sum`, `min`, `max`, and `average` accept declared number or money fields only.
- Aggregate field names must be lower-camel-case strings that resolve to own declared fields.
- Missing and `null` optional values are skipped.
- `sum` returns `0` when no matching numeric values exist.
- `min`, `max`, and `average` return `null` when no matching numeric values exist.
- Every source value and final aggregate result must be finite.
- `sum` rejects a non-finite running or final result.
- `average` uses a scaled running mean so a finite average remains available even when a naive intermediate sum would overflow.
- Aggregate queries use the same validated operator matrix as ordinary queries.

## Same-action working state

The enhanced collection client delegates mutations to the established base client. The base client updates its mutable working snapshot before recording each operation.

Every enhanced query or aggregate starts from `baseCollection.query()` with no filters, so it sees:

- records inserted earlier in the action
- updates applied earlier in the action
- removals applied earlier in the action

The resulting durable operations remain ordered and are committed through the existing host transaction path.

## Compatibility boundary

SDK 1.0 and 1.1 definitions are passed directly to the established runner without wrapping.

Their behavior remains unchanged:

- query operators remain `eq`, `gte`, and `lte` where previously supported
- text `neq`, `contains`, and `startsWith` remain unavailable
- boolean `neq` remains unavailable
- `min`, `max`, and `average` remain unavailable
- existing `sum` behavior remains on the established implementation

The public SDK package is intentionally unchanged until the final activation slice.

## Security boundary

This slice does not expose:

- raw SQL
- joins
- arbitrary predicate functions
- regular expressions
- locale selection
- cross-tool data
- database handles
- unbounded expression trees
- native objects or callbacks

Queries remain flat declarative objects with exact keys, own declared fields, finite primitive values, validated operators, and bounded offset and limit values.

## Coverage

Connected Android instrumentation covers:

- text equality, inequality, case-insensitive Unicode containment, and prefix matching
- boolean equality and inequality
- the complete number, money, date, and date-time comparison surface
- AND-combined filters
- ordering, offset, and limit preservation
- queries and aggregates during screen rendering
- number and money aggregates
- optional and missing value skipping
- empty aggregate semantics
- same-action insert, update, and remove visibility
- unsupported operator/type combinations
- malformed query objects
- invalid canonical date filters
- unknown and inherited field names
- non-finite query values
- non-numeric and non-string aggregate fields
- aggregate overflow
- large finite averages that would overflow a naive sum
- unchanged SDK 1.1 behavior
- preservation of base definition validation

## Required local validation

```powershell
pnpm format
pnpm check

pnpm --dir apps/mobile exec expo prebuild `
  --platform android `
  --clean `
  --no-install

Set-Location apps/mobile/android
.\gradlew.bat :app:assembleDebug connectedDebugAndroidTest
```

The Android build must compile the wrapper translation unit and generated runner string. Connected instrumentation must pass the entire query and aggregate suite as well as all prior QuickJS tests.

## Deferred to activation

The final SDK 1.2 activation slice will publish the expanded `QueryOperator` union, collection aggregate methods, generated declarations, authoring documentation, templates, and normal installed-script support after every frozen SDK 1.2 capability is complete.
