# Pocket Tools Authoring Error Codes

The local authoring commands return a nonzero exit code and a stable machine-readable `error.code` when a script cannot be accepted.

Use `--json` for automation:

```bash
pnpm mini-app validate ./tool.miniapp.js --json
pnpm mini-app inspect ./tool.miniapp.js --json
```

## Command and source failures

| Code | Meaning |
| --- | --- |
| `USAGE_ERROR` | The command or arguments are invalid. |
| `SOURCE_READ_FAILED` | The supplied source file could not be read. |
| `AUTHORING_TOOL_FAILED` | The authoring tool itself failed outside the script runtime. |
| `RUNTIME_SOURCE_MISSING` | The Android module no longer contains an expected embedded SDK or runner source. |
| `RUNTIME_SOURCE_INVALID` | An embedded source could not be extracted safely. |

## Script and definition failures

| Code | Meaning |
| --- | --- |
| `INVALID_SCRIPT` | The module does not export a valid mini-app definition or contains an invalid named group. |
| `INVALID_MANIFEST` | The manifest is missing or malformed. |
| `UNSUPPORTED_SDK_VERSION` | The script does not declare frozen `sdkVersion: 1`. |
| `UNSUPPORTED_MODULE` | The script imported anything other than `@pocket-tools/sdk`. |
| `VALIDATION_FAILED` | Canonical SDK definition validation failed. JSON output includes `issues` with `path` and `message`. |
| `ASYNC_NOT_SUPPORTED` | The script used top-level await or returned a promise from a screen or action. |
| `INVALID_BRIDGE_VALUE` | A value crossing the SDK boundary is not finite and serializable. |
| `INVALID_UI_TREE` | A rendered UI tree contains an unsupported node, property, binding, target, size, or depth. |
| `UNKNOWN_SCREEN` | A requested screen is not declared. |
| `UNKNOWN_ACTION` | A requested action is not declared. |
| `UNKNOWN_COLLECTION` | A requested collection is not declared. |
| `RECORD_NOT_FOUND` | An update or remove operation targeted a missing record. |
| `TIMER_NOT_FOUND` | A timer operation targeted a timer that is not active. |
| `INVALID_RUNTIME_RESPONSE` | The embedded runner returned a malformed inspection shape. |

## Sandbox failures

| Code | Meaning |
| --- | --- |
| `RUNTIME_TIMEOUT` | QuickJS exceeded the authoring execution deadline. |
| `RUNTIME_MEMORY_LIMIT` | QuickJS exceeded its memory limit or could not allocate. |
| `RUNTIME_STACK_LIMIT` | QuickJS exceeded its stack limit. |
| `RUNTIME_ERROR` | QuickJS rejected the script without a more specific code. |

The Android host has additional native request, result, logging, and allocation containment codes. The authoring commands preserve any explicit code emitted by the same embedded runner rather than remapping it to a different SDK error.

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
