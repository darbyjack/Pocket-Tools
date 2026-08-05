# Pocket Tools

Pocket Tools is an Android-first Expo host for small personal utilities authored as one JavaScript mini-app module. Scripts execute inside isolated QuickJS-NG runtimes, describe native UI declaratively, and use host-owned SQLite settings, records, durable timers, and local notifications.

The existing reference scripts exercise the compatibility platform:

- **Bathroom Pay** uses multiple screens, navigation, conditional settings, actions, records, aggregates, and a durable timer.
- **Tip Splitter** uses script-owned native input nodes, layout, host formatting, and deterministic rerendering.

Their business logic lives only under `examples/*.miniapp.js`; the host contains no mini-app-specific runtime, storage, rendering, or hook code.

## Development rules

Read [AGENTS.md](AGENTS.md) before changing the project. SDK 1.0 is the original frozen MVP contract, SDK 1.1 is the first explicit additive release, and SDK 1.2 is the current public contract defined in [Pocket Tools SDK 1.2 Contract](docs/SDK_1_2_CONTRACT.md).

No GitHub Actions workflow is enabled. Repository checks and Android builds are run manually until CI is deliberately introduced later.

## Current host path

```text
single-file mini-app source
  → local or on-device validation and isolated preview
  → installed active source in SQLite
  → fresh bounded QuickJS-NG runtime
  → virtual @pocket-tools/sdk module
  → serialized UI, interaction input, operations, effects, and notification intent
  → React Native response and target validation
  → host-owned native renderer, persistence, output, and notification reconciliation
  → schema-validated isolated settings, records, timers, and notification registry
```

Bundled reference scripts are imported into the installed tool collection only once. Pasted and bundled scripts then use the same installed-source runtime path. A user can paste, preview, install, run, edit, update, roll back, export, duplicate, back up, restore, and remove a script entirely on Android without rebuilding Pocket Tools.

The canonical delivery map is [Wayfinder: Pocket Tools Android and SDK roadmap](https://github.com/darbyjack/Pocket-Tools/issues/1).

## Offline SDK

Pocket Tools supports SDK 1.0, SDK 1.1, and SDK 1.2. The current public version is SDK 1.2.

SDK 1.0 provides:

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

SDK 1.1 adds reusable action descriptors, actionable list items, destructive intent, disabled actions, and host-owned confirmation while retaining SDK 1.0 compatibility.

SDK 1.2 adds:

- Transactional setting `set` and `reset`
- Canonical date and date-time settings, fields, and native inputs
- Bounded multi-select settings and input
- Expanded local query operators plus `min`, `max`, and `average`
- Tappable primary list-row actions
- Multiline text and numeric input hints
- Host-owned badges, progress, and fixed semantic icons
- Host feedback plus copy/share output effects
- Immediate, date, daily, and weekly local notifications
- Android notification permission, channels, exact-access blocking/recovery, startup recovery, restore reconciliation, removal cleanup, and tap routing
- Phone notification mirroring through normal Android/Galaxy Wearable settings to a paired watch

The SDK intentionally excludes arbitrary network, filesystem, location, secrets, custom native modules, script-owned platform components, arbitrary background JavaScript, and permission manifests. Notifications, clipboard, and sharing are available only through the narrow documented host-owned SDK clients.

See [Pocket Tools Offline Mini-App SDK](docs/SDK_OVERVIEW.md) for the complete supported contract.

## Author a mini-app

Start with the [SDK 1.2 Agent Authoring Guide](docs/AGENT_AUTHORING.md). It contains the executable template, complete public surface, unsupported API list, local commands, and final delivery checklist.

For delegation, use the [canonical copy-and-paste agent prompt](docs/AGENT_PROMPT.md). The committed [SDK declarations](packages/sdk-contract/dist/index.d.ts) provide editor and agent type context.

Validate and inspect a script without launching Android:

```bash
pnpm validate:mini-app ./path/to/tool.miniapp.js
pnpm inspect:mini-app ./path/to/tool.miniapp.js

pnpm mini-app validate ./path/to/tool.miniapp.js --json
pnpm mini-app inspect ./path/to/tool.miniapp.js --json
```

These commands execute the same composed SDK and runner wrapper chain used by the Android native module, then apply the canonical SDK definition validator.

## Install a mini-app on Android

1. Open Pocket Tools and choose **Add tool**.
2. Paste one SDK 1.0, SDK 1.1, or SDK 1.2 JavaScript module.
3. Choose **Check**.
4. Choose **Preview**.
5. Choose **Install tool** after the preview is ready.

Updates render against a cloned copy of current installed state before the active source changes. Failed validation, preview, or first render leaves the working installation untouched. Successful updates preserve the previous source for rollback.

Open a tool and choose **Manage** for edit, duplicate, script export, backup, rollback, notification settings, and removal.

See [Installed Mini-App Lifecycle](docs/INSTALLED_MINI_APPS.md) for storage, preview, update, rollback, export, duplication, notification reconciliation, and removal behavior.

## Back up and restore

### One installed tool

Open a tool, choose **Manage**, then choose **Back up tool** to share a versioned JSON document containing both saved sources, manifest metadata, settings, records, active durable timer timestamps, and the tool-owned notification registry. Open **Settings** and choose **Restore a tool** to paste, check, and restore that document transactionally.

Restoring over an existing manifest ID requires explicit confirmation. Invalid backups and failed SQLite or notification reconciliation leave the existing installation unchanged.

See [Portable Mini-App Backups](docs/PORTABLE_BACKUPS.md).

### Complete Pocket Tools state

Open **Settings** and choose **Back up everything** to share one versioned host backup containing every installed tool plus retained settings, records, timers, and notification registry state. Choose **Restore everything** to validate every installed source and replace all user-owned state in one transaction after explicit confirmation.

Preview and lifecycle-diagnostic namespaces are excluded. Internal host metadata is preserved.

See [Complete Host Backups](docs/HOST_BACKUPS.md).

## Validate lifecycle and isolation

Open **Settings**, then choose **Diagnostics** to run the repeatable namespace, failed-invocation recovery, deletion, and force-stop timer tests.

The immediate suite creates two temporary installed scripts with colliding setting, collection, and timer names and proves that their state remains isolated. The timer procedure spans two launches and requires confirming with `adb shell pidof` that the application process is absent while the durable timer remains active.

See [Lifecycle and Namespace Diagnostics](docs/LIFECYCLE_DIAGNOSTICS.md) for the complete evidence procedure and current verification boundary.

## Ordinary script acceptance

The ordinary authoring path has been physically proven for earlier SDK versions. SDK 1.2 completion additionally requires a docs-only agent to author, validate, preview, install, exercise, update, roll back, export, back up, remove, and restore a representative 1.2 tool through the normal Android workflow.

The repeatable procedure is documented in [Ordinary Agent-Script Acceptance](docs/ORDINARY_SCRIPT_ACCEPTANCE.md).

## Android build target

The project is configured for the Samsung Galaxy S24 Ultra's `arm64-v8a` runtime. Clean prebuilds produce ARM64-only native builds, and release builds enable R8 minification plus unused-resource shrinking. This reduces native build work and APK size, but generated APKs will not install on x86 emulators or 32-bit ARM devices.

See [Pocket Tools Mobile](apps/mobile/README.md#galaxy-s24-ultra-build-target) for regeneration, build, ABI verification, and APK output commands.

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

`pnpm android` synchronizes `examples/*.miniapp.js` into the generated one-time seed catalog and starts the Android development build. Expo Go cannot run Pocket Tools because the app contains custom native QuickJS and notification modules.

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
    sdkVersion: "1.2",
  },
  screens: {
    home() {
      return ui.page({
        title: "Example Tool",
        children: [
          ui.badge({ text: "Ready", tone: "success" }),
          ui.text({ text: "Hello from a script." }),
        ],
      });
    },
  },
});
```

The host rejects unsupported imports, ambient native access, unknown SDK properties, malformed definitions, invalid settings and records, invalid operation/effect lists, undeclared actions/screens, invalid notification targets, invalid interaction and bridge values, and invalid UI output.

## Documentation

- [SDK 1.2 agent authoring guide](docs/AGENT_AUTHORING.md)
- [Canonical agent prompt](docs/AGENT_PROMPT.md)
- [Authoring error codes](docs/AUTHORING_ERRORS.md)
- [Installed mini-app lifecycle](docs/INSTALLED_MINI_APPS.md)
- [Portable single-app backups](docs/PORTABLE_BACKUPS.md)
- [Complete host backups](docs/HOST_BACKUPS.md)
- [Lifecycle and namespace diagnostics](docs/LIFECYCLE_DIAGNOSTICS.md)
- [Ordinary agent-script acceptance](docs/ORDINARY_SCRIPT_ACCEPTANCE.md)
- [SDK overview](docs/SDK_OVERVIEW.md)
- [SDK 1.2 contract](docs/SDK_1_2_CONTRACT.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Security model](docs/SECURITY_MODEL.md)
- [Android slice](docs/ANDROID_SLICE.md)
- [Bathroom Pay requirements](docs/BATHROOM_PAY_REQUIREMENTS.md)
- [Mobile build instructions](apps/mobile/README.md)
