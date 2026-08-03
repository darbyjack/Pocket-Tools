# Pocket Tools

Pocket Tools is an Android-first host for small, scriptable personal utilities. A mini app is one JavaScript module that uses a small host-owned SDK and renders through native components.

The first reference utility is **Bathroom Pay**, which tracks bathroom-trip time and calculates its gross pay equivalent without adding Bathroom Pay-specific behavior to the host.

## Development rules

Read [AGENTS.md](AGENTS.md) before changing the project. The SDK contains only the settings, storage, timer, and UI primitives required by the current working slice. New APIs are added only when the next end-to-end layer needs them.

## Current phase

The Android application connects the first complete product path:

```text
bathroom-pay.miniapp.js
  → isolated QuickJS-NG runtime
  → serialized UI and operation results
  → React Native renderer
  → Expo SQLite settings, records, and timers
```

The implementation remains intentionally narrow: one bundled script, one home screen, the current SDK nodes, and only the storage and timer operations Bathroom Pay uses.

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

`pnpm android` synchronizes the canonical Bathroom Pay source into the mobile bundle and runs the Android development build. Expo Go cannot run Pocket Tools because the app contains a custom native QuickJS module.

Individual checks:

```bash
pnpm sync:examples:check
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
```

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
- [Android Bathroom Pay slice](docs/ANDROID_SLICE.md)
- [Security model](docs/SECURITY_MODEL.md)
- [SDK v1 overview](docs/SDK_OVERVIEW.md)
- [Bathroom Pay requirements](docs/BATHROOM_PAY_REQUIREMENTS.md)
- [Mobile build instructions](apps/mobile/README.md)
