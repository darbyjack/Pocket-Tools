# Pocket Tools

Pocket Tools is an Android-first Expo host for small personal utilities authored as one JavaScript mini-app module. Scripts execute inside isolated QuickJS-NG runtimes, describe native UI declaratively, and use host-owned SQLite settings, records, and durable timers.

The existing reference scripts are sufficient to exercise the platform:

- **Bathroom Pay** uses multiple screens, navigation, conditional settings, actions, records, aggregates, and a durable timer.
- **Tip Splitter** uses script-owned native input nodes, layout, host formatting, and deterministic rerendering.

Their business logic lives only under `examples/*.miniapp.js`; the host contains no mini-app-specific runtime, storage, rendering, or hook code.

## Development rules

Read [AGENTS.md](AGENTS.md) before changing the project. SDK v1 is frozen for the MVP. New public SDK surface requires an explicit post-MVP version decision rather than an incidental v1 addition.

No GitHub Actions workflow is enabled. Repository checks and Android builds are run manually until CI is deliberately introduced later.

## Current host path

```text
single-file mini-app source
  → on-device validation and isolated preview
  → installed active source in SQLite
  → fresh bounded QuickJS-NG runtime
  → frozen virtual @pocket-tools/sdk module
  → serialized UI, interaction input, and explicit operation results
  → React Native response and target validation
  → host-owned native renderer and active-screen state
  → schema-validated isolated settings, records, and timers
```

Bundled reference scripts are imported into the installed mini-app library only once. Pasted and bundled scripts then use the same installed-source runtime path. A user can paste, preview, install, run, edit, update, roll back, export, duplicate, and remove a script entirely on Android without rebuilding Pocket Tools.

The canonical delivery map is [Wayfinder: Deliver the Pocket Tools Android MVP](https://github.com/darbyjack/Pocket-Tools/issues/1).

## Frozen offline SDK v1

SDK v1 supports:

- Text, boolean, number, money, and select settings
- Text, boolean, number, money, and datetime collection fields
- Insert, get, update, remove, query, count, and sum
- Typed equality and range filters, sorting, offset, and limit
- Multiple synchronous screens and actions
- Finite serializable input for record-targeted buttons and navigation
- Host-owned navigation and deterministic rerendering
- Native page, section, row, column, heading, text, input, toggle, select, button, metric, timer, summary, list, and empty-state nodes
- Durable start/get/stop timers
- Host-owned plain, number, USD money, and duration formatting with ISO datetime storage

SDK v1 intentionally excludes network, files, location, notifications, secrets, custom native modules, arbitrary background JavaScript, migrations, and compatibility shims.

See [Frozen Offline Mini App SDK v1](docs/SDK_OVERVIEW.md) for the complete contract.

## Author a mini-app

Start with the [SDK v1 Agent Authoring Guide](docs/AGENT_AUTHORING.md). It contains the executable template, full authoring rules, unsupported API list, local commands, and final delivery checklist.

For delegation, use the [canonical copy-and-paste agent prompt](docs/AGENT_PROMPT.md). The committed [SDK declarations](packages/sdk-contract/dist/index.d.ts) provide editor and agent type context.

Validate and inspect a script without launching Android:

```bash
pnpm validate:mini-app ./path/to/tool.miniapp.js
pnpm inspect:mini-app ./path/to/tool.miniapp.js

pnpm mini-app validate ./path/to/tool.miniapp.js --json
pnpm mini-app inspect ./path/to/tool.miniapp.js --json
```

These commands execute the exact SDK and runner source embedded in the Android native module under QuickJS-NG WASM, then apply the canonical SDK definition validator.

## Install a mini-app on Android

1. Open the mini-app library and choose **Add script**.
2. Paste one SDK v1 JavaScript module.
3. Validate it.
4. Preview it in a disposable storage namespace.
5. Install it after the current exact source completes its first render.

Updates render against a cloned copy of current installed state before the active source changes. Failed validation, preview, or first render leaves the working installation untouched. Successful updates preserve the previous source for rollback.

See [Installed Mini-App Lifecycle](docs/INSTALLED_MINI_APPS.md) for storage, preview, update, rollback, export, duplication, and removal behavior.

## Validate lifecycle and isolation

Open **Host diagnostics** from the installed mini-app library to run the repeatable namespace, failed-invocation recovery, deletion, and force-stop timer tests.

The immediate suite creates two temporary installed scripts with colliding setting, collection, and timer names and proves that their state remains isolated. The timer procedure spans two launches and requires confirming with `adb shell pidof` that the application process is absent while the durable timer remains active.

See [Lifecycle and Namespace Diagnostics](docs/LIFECYCLE_DIAGNOSTICS.md) for the complete evidence procedure and current verification boundary.

## Requirements

- Node.js 24.16 or newer
- pnpm 11.17.0 through Corepack
- Android Studio and an Android SDK supported by Expo SDK 57
- Android NDK 26 or newer for QuickJS-NG

```bash
corepack enable
pnpm install
pnpm check
pnpm android
```

`pnpm android` synchronizes `examples/*.miniapp.js` into the generated one-time seed catalog and starts the Android development build. Expo Go cannot run Pocket Tools because the app contains a custom native QuickJS module.

Individual checks:

```bash
pnpm sync:mini-apps:check
pnpm sdk:declarations:check
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
```

## Minimal mini-app shape

```js
import { defineMiniApp, ui } from "@pocket-tools/sdk";

export default defineMiniApp({
  manifest: {
    id: "example-tool",
    name: "Example Tool",
    sdkVersion: 1,
  },
  screens: {
    home() {
      return ui.page({
        title: "Example Tool",
        children: [ui.text({ text: "Hello from a script." })],
      });
    },
  },
});
```

The host rejects unsupported imports, ambient native access, unknown SDK properties, malformed definitions, invalid settings and records, invalid operation lists, undeclared actions/screens, invalid interaction and bridge values, and invalid UI output.

## Documentation

- [Agent authoring guide](docs/AGENT_AUTHORING.md)
- [Canonical agent prompt](docs/AGENT_PROMPT.md)
- [Authoring error codes](docs/AUTHORING_ERRORS.md)
- [Installed mini-app lifecycle](docs/INSTALLED_MINI_APPS.md)
- [Lifecycle and namespace diagnostics](docs/LIFECYCLE_DIAGNOSTICS.md)
- [Frozen SDK v1](docs/SDK_OVERVIEW.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Security model](docs/SECURITY_MODEL.md)
- [Android slice](docs/ANDROID_SLICE.md)
- [Bathroom Pay requirements](docs/BATHROOM_PAY_REQUIREMENTS.md)
- [Mobile build instructions](apps/mobile/README.md)
