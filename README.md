# Pocket Tools

Pocket Tools is an Android-first host for small, scriptable personal utilities. A mini app is one JavaScript module that uses a small host-owned SDK and renders through native components.

The first reference utility is **Bathroom Pay**, which tracks bathroom-trip time and calculates its gross pay equivalent without adding Bathroom Pay-specific behavior to the host.

## Development rules

Read [AGENTS.md](AGENTS.md) before changing the project. The current SDK contains only the settings, storage, timer, and UI primitives required by the first Bathroom Pay slice. New APIs are added only when the next working end-to-end slice needs them.

## Current phase

This pull request establishes the repository and the smallest public contract needed to express Bathroom Pay. It does not add compatibility layers, migrations, permissions, or unused UI components.

The next implementation step must make this contract work end to end on Android before the SDK grows further.

The canonical delivery map is [Wayfinder: Deliver the Pocket Tools Android MVP](https://github.com/darbyjack/Pocket-Tools/issues/1).

## Requirements

- Node.js 24.16 or newer
- pnpm 11.17.0 through Corepack

```bash
corepack enable
pnpm install
pnpm check
```

Individual checks:

```bash
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

The host rejects external imports, ambient native access, unsupported SDK identifiers, invalid bridge values, and invalid UI trees.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Security model](docs/SECURITY_MODEL.md)
- [SDK v1 overview](docs/SDK_OVERVIEW.md)
- [Bathroom Pay requirements](docs/BATHROOM_PAY_REQUIREMENTS.md)

## Repository roadmap

Implementation is tracked through the child tickets of the wayfinder map. Work is delivered through focused branches and pull requests, one frontier ticket at a time.
