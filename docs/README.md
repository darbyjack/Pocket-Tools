# Pocket Tools Documentation

SDK 1.2 is the current public contract. This index is the canonical map for maintained documentation.

## Contributors

- [Contributing](../CONTRIBUTING.md) — branch, validation, SDK-change, and architecture rules.
- [Mobile Development](../apps/mobile/README.md) — Android setup, prebuild, APK builds, installation, and connected tests.
- [Lifecycle Diagnostics](LIFECYCLE_DIAGNOSTICS.md) — repeatable namespace and process-death checks.
- [Release and Acceptance](ORDINARY_SCRIPT_ACCEPTANCE.md) — repository, Android, compatibility, accessibility, and ordinary-tool release procedure.

## Mini-app and tool authors

- [SDK 1.2 Agent Authoring Guide](AGENT_AUTHORING.md) — canonical authoring surface, synchronized executable template, commands, and checklist.
- [Canonical Agent Prompt](AGENT_PROMPT.md) — copy-and-paste prompt for delegating one mini-app.
- [Authoring Error Codes](AUTHORING_ERRORS.md) — stable local and Android failure names.
- [Generated SDK Declarations](../packages/sdk-contract/dist/index.d.ts) — authoritative editor and agent types.
- [Reference Examples](../examples/) — ordinary SDK 1.0 and 1.1 compatibility tools.
- [SDK 1.2 Acceptance Fixture](fixtures/sdk12-agent-proof.miniapp.js) — representative public SDK 1.2 tool used by release acceptance.

## SDK contract

- [SDK Overview](SDK_OVERVIEW.md) — supported versions and capability summary.
- [Released SDK 1.2 Contract](SDK_1_2_CONTRACT.md) — complete normative contract and compatibility boundaries.
- [Data and Settings](SDK_1_2_DATA_AND_SETTINGS.md) — setting writes, dates, multi-select, queries, and aggregates.
- [UI and Output](SDK_1_2_UI_AND_OUTPUT.md) — native controls, rows, badges, progress, icons, feedback, copy, and share.
- [Notifications](SDK_1_2_NOTIFICATIONS.md) — public notification API and Android-owned delivery lifecycle.

## Runtime, security, and lifecycle

- [Architecture](ARCHITECTURE.md) — execution path, trusted boundaries, persistence, and repository layout.
- [Security Model](SECURITY_MODEL.md) — sandbox limits, host authority, validation, and deliberate exclusions.
- [Installed Mini-App Lifecycle](INSTALLED_MINI_APPS.md) — preview, install, update, rollback, export, duplication, and removal.
- [Portable Tool Backups](PORTABLE_BACKUPS.md) — one-tool backup and restore format.
- [Complete-Host Backups](HOST_BACKUPS.md) — all user-owned tool state backup and atomic replacement.

## Source-of-truth order

When documents appear to conflict, use this order:

1. Released TypeScript contract and generated declarations.
2. Executable QuickJS SDK, host validators, and native implementation.
3. [SDK 1.2 Contract](SDK_1_2_CONTRACT.md).
4. [Agent Authoring Guide](AGENT_AUTHORING.md).
5. Focused explanatory references in this index.

Implementation history belongs in Git and merged pull requests, not in maintained public documentation.
