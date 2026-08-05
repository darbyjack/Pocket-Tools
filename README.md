# Pocket Tools

Pocket Tools is an Android-first Expo host for offline utilities written as single JavaScript mini-app modules. Mini-apps run in fresh bounded QuickJS-NG runtimes, return declarative native UI, and use host-owned settings, records, timers, feedback, copy/share output, and local notifications.

SDK 1.2 is the current public contract. SDK 1.0 and 1.1 remain supported for existing tools.

## Start here

| Audience | Entry point |
| --- | --- |
| Project contributors | [CONTRIBUTING.md](CONTRIBUTING.md) |
| Mini-app and agent authors | [SDK 1.2 Authoring Guide](docs/AGENT_AUTHORING.md) |
| Delegating mini-app creation | [Canonical Agent Prompt](docs/AGENT_PROMPT.md) |
| Complete documentation map | [Documentation Index](docs/README.md) |
| Android development and builds | [Pocket Tools Mobile](apps/mobile/README.md) |
| Runtime architecture and security | [Architecture](docs/ARCHITECTURE.md) · [Security Model](docs/SECURITY_MODEL.md) |
| Released SDK contract | [SDK Overview](docs/SDK_OVERVIEW.md) · [SDK 1.2 Contract](docs/SDK_1_2_CONTRACT.md) |

## How it works

```text
single-file mini-app source
  → validation and isolated preview
  → installed source in host-owned SQLite
  → fresh bounded QuickJS-NG invocation
  → virtual @pocket-tools/sdk module
  → validated UI, operations, effects, and notification intent
  → host-owned native rendering, persistence, and Android services
```

Bundled examples are seeded into the installed-tool collection once. Bundled and pasted tools then use the same runtime, storage, renderer, lifecycle, and security path. The host contains no Bathroom Pay- or Tip Splitter-specific behavior.

## Author a mini-app

New mini-apps should declare `sdkVersion: "1.2"` and import only from `@pocket-tools/sdk`.

```js
import { defineMiniApp, ui } from "@pocket-tools/sdk";

export default defineMiniApp({
  manifest: {
    id: "example-tool",
    name: "Example Tool",
    description: "Show one host-rendered message.",
    sdkVersion: "1.2",
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

Validate and inspect a source file without launching Android:

```bash
pnpm validate:mini-app ./path/to/tool.miniapp.js
pnpm inspect:mini-app ./path/to/tool.miniapp.js

pnpm mini-app validate ./path/to/tool.miniapp.js --json
pnpm mini-app inspect ./path/to/tool.miniapp.js --json
```

The executable template in [the authoring guide](docs/AGENT_AUTHORING.md) is synchronized with [`docs/fixtures/agent-template.miniapp.js`](docs/fixtures/agent-template.miniapp.js). The generated declarations in [`packages/sdk-contract/dist/`](packages/sdk-contract/dist/) are the editor and agent type authority.

## Develop the host

Requirements:

- Node.js 24.16 or newer
- pnpm 11.17.0 through Corepack
- Android Studio and an Android SDK supported by Expo SDK 57
- Android NDK 26 or newer for QuickJS-NG
- A 64-bit ARM Android device for the configured native build target

```bash
corepack enable
pnpm install
pnpm check
pnpm android
```

Expo Go cannot run Pocket Tools because the app includes custom QuickJS and notification native modules. No GitHub Actions workflows are enabled; repository and Android validation are run manually.

## Public capability boundary

SDK 1.2 provides isolated local settings and collections, transactional actions, durable timers, host-owned native UI, feedback, copy/share output, and tool-scoped local notifications.

It does not provide arbitrary network or filesystem access, location, secrets, external packages, custom native modules or components, raw platform APIs, remote push, or arbitrary background JavaScript. See the [Security Model](docs/SECURITY_MODEL.md) for the complete boundary.
