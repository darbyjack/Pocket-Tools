# Pocket Tools Authoring Error Codes

The local authoring commands return a nonzero exit code and a stable machine-readable `error.code` when a script cannot be accepted.

Use `--json` for automation:

```bash
pnpm mini-app validate ./tool.miniapp.js --json
pnpm mini-app inspect ./tool.miniapp.js --json
```

## Command and source failures

| Code                     | Meaning                                                                          |
| ------------------------ | -------------------------------------------------------------------------------- |
| `USAGE_ERROR`            | The command or arguments are invalid.                                            |
| `SOURCE_READ_FAILED`     | The supplied source file could not be read.                                      |
| `AUTHORING_TOOL_FAILED`  | The authoring tool itself failed outside the script runtime.                     |
| `RUNTIME_SOURCE_MISSING` | An expected embedded SDK or runner source cannot be found.                       |
| `RUNTIME_SOURCE_INVALID` | An embedded source or wrapper cannot be extracted or composed safely.            |

## Validation and inspection failures

| Code                       | Meaning                                                                                                                                               |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `INVALID_SCRIPT`           | The module does not default-export one valid mini-app definition, lacks `home`, or contains an invalid named group.                                   |
| `INVALID_MANIFEST`         | The manifest is missing or malformed.                                                                                                                 |
| `UNSUPPORTED_SDK_VERSION`  | The manifest does not declare a supported version. This host accepts `"1.0"`, `"1.1"`, and `"1.2"`; legacy numeric `1` normalizes to `"1.0"`. |
| `UNSUPPORTED_MODULE`       | The script imported anything other than `@pocket-tools/sdk`, used a re-export, or used dynamic import.                                                |
| `TYPECHECK_FAILED`         | The script does not typecheck against the committed SDK 1.2 declarations. JSON output includes TypeScript code, file, line, column, and message.      |
| `VALIDATION_FAILED`        | Canonical definition, UI, operation, effect, notification, or capability-version validation failed. JSON output may include exact issues.             |
| `ASYNC_NOT_SUPPORTED`      | The script used top-level await or cannot be inspected synchronously.                                                                                 |
| `INVALID_BRIDGE_VALUE`     | Inspection or execution produced a value that is not finite and serializable.                                                                         |
| `INVALID_RUNTIME_RESPONSE` | The embedded runner returned a malformed inspection or runtime shape.                                                                                 |

## Sandbox failures

| Code                   | Meaning                                                   |
| ---------------------- | --------------------------------------------------------- |
| `RUNTIME_TIMEOUT`      | QuickJS exceeded the authoring execution deadline.        |
| `RUNTIME_MEMORY_LIMIT` | QuickJS exceeded its memory limit or could not allocate.  |
| `RUNTIME_STACK_LIMIT`  | QuickJS exceeded its stack limit.                         |
| `RUNTIME_ERROR`        | QuickJS rejected the script without a more specific code. |

## Android preview, render, and action failures

The Android host may additionally return:

| Code                      | Meaning                                                                 |
| ------------------------- | ----------------------------------------------------------------------- |
| `INVALID_UI_TREE`         | A screen returned malformed, unsupported, or version-incompatible UI.   |
| `UNKNOWN_SCREEN`          | A screen or notification open target is not declared.                   |
| `UNKNOWN_ACTION`          | An action control targets an undeclared action.                         |
| `UNKNOWN_COLLECTION`      | An operation or query references an undeclared collection.              |
| `RECORD_NOT_FOUND`        | An update or removal targets a record that does not exist.              |
| `TIMER_NOT_FOUND`         | A timer stop targets a timer that is not running.                       |
| `INVALID_OPERATION`       | A runtime operation is malformed, unsupported, or out of order.         |
| `INVALID_NATIVE_RESPONSE` | The native boundary returned malformed operations, effects, or logs.    |
| `INSTALLATION_FAILED`     | Preview, install, update, rollback, duplication, or persistence failed. |

Notification delivery can also fail because permission is denied, exact delivery is unavailable, a request is malformed, or native reconciliation cannot complete. The host reports the specific stable code supplied by the notification layer; scripts must not parse human-readable wording.

## Transactional failure behavior

One action is committed as one host transaction:

- Setting and collection writes are rolled back together when validation or persistence fails.
- Notification reconciliation and host effects run only after durable data operations succeed.
- A failed action does not partially apply later operations or effects.
- Preview storage remains isolated from installed-tool storage.

## JSON failure shape

```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "settings.title.default: Must satisfy the declared text length bounds.",
    "issues": [
      {
        "path": "settings.title.default",
        "message": "Must satisfy the declared text length bounds."
      }
    ]
  }
}
```

Do not parse the human-readable message when `code` or `issues` provides the required decision.
