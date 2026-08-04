# SDK 1.2 fixed host icons

## Status

This implementation is dormant. It does not activate SDK 1.2 for ordinary authoring, validation, inspection, preview, installation, update, rollback, duplication, export, backup, restore, launch, or removal.

The public version boundary remains unchanged:

- `SDK_VERSION` remains `"1.1"`.
- `SUPPORTED_SDK_VERSIONS` remains `"1.0"` and `"1.1"`.
- Public SDK sources, generated declarations, canonical templates, examples, and normal source tooling do not expose icons yet.

This is the final dormant feature slice. The following activation sweep publishes the complete frozen SDK 1.2 contract together.

## Frozen contract

```ts
type UiIconName =
  | "add"
  | "edit"
  | "delete"
  | "check"
  | "calendar"
  | "clock"
  | "copy"
  | "share"
  | "search"
  | "settings"
  | "warning"
  | "info"
  | "money"
  | "list"
  | "refresh";

interface ActionControl {
  readonly label: string;
  readonly action: string;
  readonly icon?: UiIconName;
}

interface ListItemNode {
  readonly leadingIcon?: UiIconName;
}
```

Illustrative dormant usage:

```ts
ui.button({
  label: "Add item",
  action: "addItem",
  icon: "add",
});

ui.listItem({
  title: "Appointment",
  leadingIcon: "calendar",
  primaryAction: ui.action({
    label: "Open appointment",
    action: "openAppointment",
    icon: "edit",
  }),
  actions: [
    ui.action({
      label: "Delete",
      action: "deleteAppointment",
      icon: "delete",
      intent: "destructive",
      confirmation: { title: "Delete appointment?" },
    }),
  ],
});
```

## Validation and security boundary

Icons:

- require SDK 1.2;
- accept exactly one name from the frozen 15-name set;
- may appear on buttons, primary row actions, and visible list-item actions through `ActionControl.icon`;
- may appear at the start of a list row through `ListItemNode.leadingIcon`;
- do not change the existing one-to-three visible action limit;
- do not change destructive confirmation, disabled state, input validation, action lookup, or row-action isolation.

Action labels remain mandatory. Primary row actions retain their required nonvisual action label. Icons are decorative and never replace visible text or TalkBack semantics.

Scripts cannot provide:

- SVG or vector path data;
- image or network URLs;
- file paths or attachments;
- icon packages or package names;
- emoji or arbitrary glyph strings;
- colors, sizes, stroke widths, fills, padding, alignment, animation, or style objects;
- markup, callbacks, arbitrary React Native components, or custom drawing.

## Embedded QuickJS behavior

The dormant native wrapper examines each rendered page before the established runner validates it.

For icon-bearing action controls and list items, it:

1. validates the SDK version and exact frozen icon name;
2. preserves the established bridge depth, complexity, and circular-reference limits;
3. removes only `icon` and `leadingIcon` while the existing SDK 1.0/1.1 page validator processes the complete structure;
4. leaves all other properties in place so unknown custom styling still fails normal exact-key validation;
5. restores the validated icon names before the trusted response crosses the native boundary.

Normal runtime parsing remains closed to these fields until public activation. Dormant parsing preserves them for implementation and instrumentation coverage.

## Host-owned Android presentation

Pocket Tools maps each semantic name to one fixed Google Material Symbol vector drawable imported from `@expo/material-symbols` and rendered through the platform-native `Icon` component from `@expo/ui`.

Only the 15 imported assets are bundled. The host owns the exact asset mapping, dimensions, spacing, and color treatment; mini-app scripts continue to provide only a semantic `UiIconName`.

- Primary button icons use the button's fixed inverse treatment.
- Destructive visible-action icons use the host danger treatment.
- Other action and list icons use the host's default or muted treatment.
- Leading list icons occupy a fixed host-controlled alignment area.
- Primary row-action icons appear at the end of the row without replacing the action label announced by TalkBack.

The icon container is hidden from accessibility. TalkBack continues to announce the existing action label, row-action label, disabled state, and confirmation flow without duplicate icon-name speech.

## Persistence and lifecycle

Icons are render-only metadata. They add no:

- SQLite state, tables, or columns;
- operations or effects;
- backup-format fields;
- restore or migration behavior;
- Android permissions, services, channels, alarms, or background execution;
- removal cleanup.

They are recalculated whenever the owning screen renders from its validated runtime snapshot.

## Automated validation

Run from the repository root:

```powershell
pnpm install
pnpm format
pnpm check
```

Regenerate Android and run the connected suite because the embedded native runner source changes:

```powershell
pnpm --dir apps/mobile exec expo prebuild `
  --platform android `
  --clean `
  --no-install

Set-Location apps/mobile/android
.\gradlew.bat :app:assembleDebug connectedDebugAndroidTest --max-workers=4
```

Coverage includes:

- all 15 frozen icon names;
- button, primary-row-action, visible-action, and leading-list placement;
- normal-protocol rejection and dormant-protocol preservation;
- unknown names, URLs, arbitrary glyphs, malformed types, and custom style fields;
- embedded QuickJS adaptation and restoration;
- SDK 1.0 and SDK 1.1 rejection and unchanged icon-free behavior.

## Galaxy S24 Ultra acceptance

Use a temporary diagnostics-only fixture without enabling public SDK 1.2 authoring.

Verify:

1. All 15 icon names have distinct, readable host-owned Material Symbol presentations.
2. Icon-bearing primary and destructive buttons retain their labels and established behavior.
3. Leading list icons align consistently with one-line and multiline list content.
4. A primary row-action icon does not replace or alter the row's TalkBack action label.
5. Visible list-action icons do not trigger the row action when pressed.
6. Disabled and destructive treatments remain visually clear.
7. Increased Android font size does not clip icons, labels, rows, action wrapping, or touch targets.
8. TalkBack announces labels and states once and does not announce decorative icons separately.
9. Background/foreground, force-stop, relaunch, and navigation preserve rendering and action behavior.
10. Existing SDK 1.0 and SDK 1.1 tools remain visually and behaviorally unchanged.

Remove the temporary acceptance fixture before merging.
