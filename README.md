# Pocket Tools

Pocket Tools is an Android-first Expo host for small personal utilities authored as one JavaScript mini-app module. Scripts execute inside isolated QuickJS-NG runtimes, describe native UI declaratively, and use host-owned SQLite settings, records, and durable timers.

The existing reference scripts are sufficient to exercise the platform:

- **Bathroom Pay** uses multiple screens, navigation, conditional settings, actions, records, aggregates, and a durable timer.
- **Tip Splitter** uses script-owned native input nodes, layout, host formatting, and deterministic rerendering.

Their business logic lives only under `examples/*.miniapp.js`; the host contains no mini-app-specific runtime, storage, rendering, or hook code.

## Development rules

Read [AGENTS.md](AGENTS.md) before changing the project. SDK v1 is frozen for the MVP after issue #6 merges. New public SDK surface requires an explicit post-MVP version decision rather than an incidental v1 addition.

No GitHub Actions workflow is enabled. Repository checks and Android builds are run manually until CI is deliberately introduced later.

## Current host path

```text
single-file mini-app source
  → generic inspection and definition validation
  → fresh bounded QuickJS-NG runtime
  → frozen virtual @pocket-tools/sdk module
  → serialized UI, interaction input, and explicit operation results
  → React Native response and target validation
  → host-owned native renderer and active-screen state
  → schema-validated Expo SQLite settings, records, and timers
```

The generated bundled catalog is temporary development seed data. The later installer layer will replace the bundled-only entry path with paste, preview, install, edit, update, rollback, export, and deletion entirely on Android.

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
- Host-owned plain, number, USD money, duration, and date-time formatting

SDK v1 intentionally excludes network, files, location, notifications, secrets, custom native modules, arbitrary background JavaScript, migrations, and compatibility shims.

See [Frozen Offline Mini App SDK v1](docs/SDK_OVERVIEW.md) for the complete contract.

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

`pnpm android` synchronizes `examples/*.miniapp.js` into the generated development catalog and starts the Android development build. Expo Go cannot run Pocket Tools because the app contains a custom native QuickJS module.

Individual checks:

```bash
pnpm sync:mini-apps:check
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

- [Architecture](docs/ARCHITECTURE.md)
- [Frozen SDK v1](docs/SDK_OVERVIEW.md)
- [Security model](docs/SECURITY_MODEL.md)
- [Android slice](docs/ANDROID_SLICE.md)
- [Bathroom Pay requirements](docs/BATHROOM_PAY_REQUIREMENTS.md)
- [Mobile build instructions](apps/mobile/README.md)
