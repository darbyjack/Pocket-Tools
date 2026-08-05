# SDK 1.2 host-owned badge nodes

## Status

This capability is public in SDK 1.2 and is available through ordinary authoring, validation, inspection, preview, installation, execution, update, rollback, export, backup/restore, and removal paths where applicable.

- `SDK_VERSION` is `"1.2"`.
- Supported manifest versions are `"1.0"`, `"1.1"`, and `"1.2"`.
- The public SDK source, generated declarations, local authoring runtime, embedded QuickJS runtime, host validators, and Android UI/lifecycle paths expose this capability.

Internal source, test, or helper names created during staged implementation may retain `sdk12` or `dormant` compatibility wording. Those names do not gate or expand the public API.

## Frozen contract

```ts
type BadgeTone = "neutral" | "info" | "success" | "warning" | "danger";

interface BadgeNode extends UiNodeBase<"badge"> {
  readonly text: string;
  readonly tone?: BadgeTone;
}

ui.badge({ text: "Completed", tone: "success" });
```

## Validation

A badge node:

- requires SDK 1.2;
- contains exact keys `type`, `text`, and optional `tone`;
- requires between 1 and 80 Unicode characters of text;
- accepts only `neutral`, `info`, `success`, `warning`, or `danger`;
- treats an omitted tone as `neutral` for host presentation;
- rejects script-provided colors, styles, icons, components, markup, callbacks, and layout controls.

Badge nodes may appear anywhere an ordinary leaf UI node is valid, including inside host-owned sections, rows, and columns. Existing layout depth and node-count limits still apply.

## Embedded QuickJS behavior

The dormant embedded SDK exposes `ui.badge(...)` only through the internal SDK 1.2 runtime layer.

Before the legacy runner validates a rendered page, the badge layer:

1. validates exact badge keys, text, tone, SDK version, bridge depth, complexity, and circular references;
2. adapts the badge to a legacy text node without exposing that representation to the script or host;
3. lets every established QuickJS and bridge validator process the complete page;
4. restores the original badge type and semantic tone before returning the trusted result.

SDK 1.0 and SDK 1.1 scripts cannot render a badge and retain their existing UI behavior.

## Host-owned Android presentation

Pocket Tools renders badges as compact, rounded host-owned labels. Each semantic tone has a fixed background, border, and text treatment selected by the host:

- `neutral` — ordinary state
- `info` — informational state
- `success` — completed or healthy state
- `warning` — attention required
- `danger` — failed or risky state

Scripts cannot choose specific colors or dimensions. Text remains the primary visible label. For accessibility, non-neutral tones are announced with their semantic status so meaning does not depend on color alone.

Badges are noninteractive. They cannot invoke actions, receive callbacks, or contain arbitrary child nodes.

## Persistence and lifecycle

Badge nodes are rendered output only. They do not add:

- SQLite tables or columns;
- runtime operations or effects;
- backup-format changes;
- restore behavior;
- Android permissions or services;
- background execution;
- removal cleanup.

A badge is recalculated whenever the owning screen renders from the current validated runtime snapshot.

## Automated validation

Run from the repository root:

```powershell
pnpm format
pnpm check
```

Regenerate Android and run the connected suite because the embedded native SDK and runner source change:

```powershell
pnpm --dir apps/mobile exec expo prebuild `
  --platform android `
  --clean `
  --no-install

Set-Location apps/mobile/android
.\gradlew.bat :app:assembleDebug connectedDebugAndroidTest --max-workers=4
```

Coverage includes:

- every frozen semantic tone;
- omitted-tone neutral behavior;
- exact keys and Unicode-aware text bounds;
- unknown tones, custom colors, and malformed values;
- nested layout rendering;
- normal-protocol rejection and dormant-protocol preservation;
- embedded QuickJS builder exposure and page restoration;
- SDK 1.0 and SDK 1.1 rejection and regression behavior.

## Galaxy S24 Ultra acceptance

Use a temporary diagnostics-only fixture without enabling public SDK 1.2 authoring.

Verify on the Galaxy S24 Ultra:

1. Neutral, info, success, warning, and danger badges are visually distinct.
2. Badge text remains readable in the current host appearance and at increased Android font size.
3. Long valid text wraps or lays out without clipping surrounding content.
4. Badges render correctly inside sections, rows, and columns.
5. Badges remain noninteractive and do not create unintended touch targets.
6. TalkBack reads the visible text.
7. TalkBack announces the semantic status for info, success, warning, and danger tones.
8. Neutral badges do not add redundant status wording.
9. Navigation, background/foreground, force-stop, and relaunch preserve normal screen rendering.
10. Existing SDK 1.0 and SDK 1.1 tools render unchanged.

Remove any temporary acceptance fixture before merging the dormant implementation branch.
