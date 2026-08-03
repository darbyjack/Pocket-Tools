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

## Validation and inspection failures

| Code | Meaning |
| --- | --- |
| `INVALID_SCRIPT` | The module does not export a valid mini-app definition or contains an invalid named group. |
| `INVALID_MANIFEST` | The manifest is missing or malformed. |
| `UNSUPPORTED_SDK_VERSION` | The script does not declare frozen `sdkVersion: 1`. |
| `UNSUPPORTED_MODULE` | The script imported anything other than `@pocket-tools/sdk`, used a re-export, or used dynamic import. |
| `TYPECHECK_FAILED` | The script does not typecheck against the committed frozen SDK declarations. JSON output includes TypeScript code, file, line, column, and message. |
| `VALIDATION_FAILED` | Canonical SDK definition validation failed. JSON output includes `issues` with exact `path` and `message` values. |
| `ASYNC_NOT_SUPPORTED` | The script used top-level await or cannot be inspected synchronously. |
| `INVALID_BRIDGE_VALUE` | Inspection produced a value that is not finite and serializable. |
| `INVALID_RUNTIME_RESPONSE` | The embedded runner returned a malformed inspection shape. |

## Sandbox failures

| Code | Meaning |
| --- | --- |
| `RUNTIME_TIMEOUT` | QuickJS exceeded the authoring execution deadline. |
| `RUNTIME_MEMORY_LIMIT` | QuickJS exceeded its memory limit or could not allocate. |
| `RUNTIME_STACK_LIMIT` | QuickJS exceeded its stack limit. |
| `RUNTIME_ERROR` | QuickJS rejected the script without a more specific code. |

## Android render and action failures

The Android host and later on-device preview flow may additionally return codes such as:

- `INVALID_UI_TREE`
- `UNKNOWN_SCREEN`
- `UNKNOWN_ACTION`
- `UNKNOWN_COLLECTION`
- `RECORD_NOT_FOUND`
- `TIMER_NOT_FOUND`
- Native source, request, result, logging, and allocation containment failures

Those codes are not promised as outcomes of the inspection-only CLI. The CLI preserves explicit errors emitted by the shared embedded runner rather than translating them into unrelated authoring codes.

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
