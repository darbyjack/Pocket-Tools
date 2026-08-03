# Pocket Tools

Pocket Tools is an Android-first host for small, scriptable personal utilities. A mini app is one JavaScript module that uses a small host-owned SDK and renders through native components.

The current reference scripts are:

- **Bathroom Pay**, which exercises durable timers, records, aggregates, actions, and conditional settings.
- **Tip Splitter**, which exercises a complete calculator built from durable script-declared inputs and native metric and summary output.

Their business logic lives only under `examples/*.miniapp.js`; the host contains no Bathroom Pay or Tip Splitter runtime, storage, rendering, or hook code.

## Development rules

Read [AGENTS.md](AGENTS.md) before changing the project. The SDK contains only the settings, storage, timer, and UI primitives required by current working mini apps. New APIs are added only when the next end-to-end layer needs them.

## Current phase

The Android application connects a generic mini-app path:

```text
examples/*.miniapp.js
  → generated bundled-script data catalog
  → generic useMiniApp(source) host path
  → isolated QuickJS-NG runtime
  → serialized UI and operation results
  → strict host UI validation
  → React Native renderer
  → Expo SQLite settings, records, and timers
```

The bundled catalog is temporary seed data for development. Adding another `examples/*.miniapp.js` file requires no host-code changes; the synchronizer discovers it automatically. Script installation and the copy-and-paste editor are later product layers.

The host validates every supported UI node against an exact property allowlist before rendering. Unknown properties, unsupported nodes, invalid action identifiers, non-finite formatted values, nested pages, and oversized trees are rejected.

The canonical delivery map is [Wayfinder: Deliver the Pocket Tools Android MVP](https://github.com/darbyjack/Pocket-Tools/issues/1).

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

`pnpm android` synchronizes every `examples/*.miniapp.js` script into the generated data catalog and runs the Android development build. Expo Go cannot run Pocket Tools because the app contains a custom native QuickJS module.

Individual checks:

```bash
pnpm sync:mini-apps:check
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
```

No GitHub Actions workflow is enabled yet. Repository checks and Android builds are run manually until CI is deliberately introduced later.

## Mini-app shape

Installed scripts import only the host-provided virtual SDK module:

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
      return ui.page({ title: "Example Tool", children: [] });
    },
  },
});
```

The host rejects unsupported imports, ambient native access, unsupported SDK identifiers, invalid bridge values, and invalid UI output.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [First Android mini-app slice](docs/ANDROID_SLICE.md)
- [Security model](docs/SECURITY_MODEL.md)
- [SDK v1 overview](docs/SDK_OVERVIEW.md)
- [Bathroom Pay requirements](docs/BATHROOM_PAY_REQUIREMENTS.md)
- [Mobile build instructions](apps/mobile/README.md)
