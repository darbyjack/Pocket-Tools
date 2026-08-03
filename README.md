# Pocket Tools

Pocket Tools is an Android-first host for small, scriptable personal utilities. A mini app is one JavaScript module authored against a versioned, capability-based SDK, then validated, previewed, permission-reviewed, and installed inside the native host.

The first reference utility is **Bathroom Pay**, which tracks bathroom-trip time and calculates its gross pay equivalent without adding any Bathroom Pay-specific behavior to the host application.

## Current phase

The repository is establishing the SDK v1 contract and security boundary before the Expo host is implemented. The canonical delivery map is [Wayfinder: Deliver the Pocket Tools Android MVP](https://github.com/darbyjack/Pocket-Tools/issues/1).

Phase 0 includes:

- Architecture and threat-model documentation
- The public TypeScript SDK contract
- Definition validation and unit tests
- A type-checked Bathroom Pay reference script
- Workspace, formatting, linting, and type-checking commands

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

Installed scripts will import only the host-provided virtual SDK module:

```js
import { defineMiniApp, ui } from "@pocket-tools/sdk";

export default defineMiniApp({
  manifest: {
    id: "example-tool",
    name: "Example Tool",
    sdkVersion: 1,
    version: 1,
  },
  screens: {
    home() {
      return ui.page({ title: "Example Tool", children: [] });
    },
  },
});
```

The host will reject external imports, ambient native access, unsupported capabilities, invalid bridge values, and UI trees that exceed documented limits.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Security model](docs/SECURITY_MODEL.md)
- [SDK v1 overview](docs/SDK_OVERVIEW.md)
- [Bathroom Pay requirements](docs/BATHROOM_PAY_REQUIREMENTS.md)

## Repository roadmap

Implementation is tracked through the child tickets of the wayfinder map. Work is delivered through focused branches and pull requests, one frontier ticket at a time.
