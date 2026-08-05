# SDK 1.2 Transactional Setting Writes

## Status

This capability is public in SDK 1.2 and is available through ordinary authoring, validation, inspection, preview, installation, execution, update, rollback, export, backup/restore, and removal paths where applicable.

- `SDK_VERSION` is `"1.2"`.
- Supported manifest versions are `"1.0"`, `"1.1"`, and `"1.2"`.
- The public SDK source, generated declarations, local authoring runtime, embedded QuickJS runtime, host validators, and Android UI/lifecycle paths expose this capability.

Internal source, test, or helper names created during staged implementation may retain `sdk12` or `dormant` compatibility wording. Those names do not gate or expand the public API.

## Internal operation model

The host response model recognizes two exact operations:

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

The React Native protocol parser accepts only these exact keys, requires a lower-camel-case setting name, and requires a finite serializable value for `setting-set`.

Structural parsing does not grant authority. Before SQLite mutation, the host additionally requires:

- an SDK 1.2 inspection
- a setting declared by the current tool
- a value accepted by that setting's schema

A forged native response paired with an SDK 1.0 or 1.1 inspection therefore fails with `UNSUPPORTED_SDK_VERSION`.

## Embedded working state

For dormant SDK 1.2 execution, the embedded runner gives the action a mutable working copy of the host setting snapshot.

`settings.set(name, value)`:

1. Requires action mode.
2. Requires a declared setting.
3. Validates the value against the current setting type, options, and bounds.
4. Validates the bridge value.
5. Updates the working snapshot.
6. Records one ordered `setting-set` operation.

`settings.reset(name)`:

1. Requires action mode.
2. Requires a declared setting.
3. Revalidates the declared default.
4. Updates the working snapshot to that default.
5. Records one ordered `setting-reset` operation.

A later `settings.get(name)` in the same action observes the updated working value. Screen rendering and inspection cannot call either write method.

SDK 1.0 and 1.1 contexts do not expose `set` or `reset` at all.

## SQLite transaction boundary

`applyRuntimeOperations(...)` applies setting operations inside the same existing SQLite transaction as collection and timer operations.

For `setting-set`, the host revalidates the requested value and upserts the setting row.

For `setting-reset`, the host reads the trusted inspected definition, revalidates its default, and upserts that exact default value.

Operations execute in list order. Multiple writes to the same setting therefore resolve to the final successful operation.

Any later failure in the same operation list rolls back earlier setting, record, and timer writes. No second setting transaction or direct script database path exists.

## Security properties

- Scripts never choose the SQLite storage namespace.
- Scripts never receive a database handle or mutable host object.
- Setting names remain scoped to the current inspected definition.
- Values are validated independently in QuickJS and again by the trusted host.
- Reset uses the host-inspected default rather than accepting a default from the operation payload.
- Lower SDK versions cannot authorize the new operations.
- Malformed operation objects are rejected by the native-response parser before the storage adapter receives them.
- A failed action returns no operation list and therefore cannot persist its working snapshot.
- SDK 1.2 remains unavailable through normal installation until the complete frozen surface is activated.

## Coverage

Automated coverage in this slice includes:

- exact protocol parsing for set and reset
- malformed and extra-key rejection
- same-action reads after set and reset
- ordered operation output
- setting schema rejection before operation recording
- rendering-time write rejection
- SDK 1.1 non-exposure
- dormant SDK 1.2 operation bounds
- canonical public validator rejection of SDK 1.2 manifests

Repository and connected Android checks remain required before merge:

```powershell
pnpm format
pnpm check

pnpm --dir apps/mobile exec expo prebuild --platform android --clean --no-install
Set-Location apps/mobile/android
.\gradlew.bat :app:assembleDebug connectedDebugAndroidTest
```

## Deferred to activation

The final SDK 1.2 activation slice will expose the public `SettingsClient` methods, generated declarations, authoring documentation, examples, inspection acceptance, and complete installed-script acceptance only after every capability in the frozen SDK 1.2 contract is implemented.
