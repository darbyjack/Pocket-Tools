# SDK 1.2 fixed host icons

## Status

This capability is public in SDK 1.2 and is available through ordinary authoring, validation, inspection, preview, installation, execution, update, rollback, export, backup/restore, and removal paths where applicable.

- `SDK_VERSION` is `"1.2"`.
- Supported manifest versions are `"1.0"`, `"1.1"`, and `"1.2"`.
- The public SDK source, generated declarations, local authoring runtime, embedded QuickJS runtime, host validators, and Android UI/lifecycle paths expose this capability.

Internal source, test, or helper names created during staged implementation may retain `sdk12` or `dormant` compatibility wording. Those names do not gate or expand the public API.

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

Pocket Tools maps each semantic SDK name to one fixed Lucide icon name rendered by `@react-native-vector-icons/lucide`.

The package uses an icon font loaded through Expo Font at runtime. Icons therefore render as ordinary React Native text-backed children and do not require Jetpack Compose views, `react-native-svg`, or another native view manager. The host owns the exact name mapping, dimensions, spacing, and color treatment; mini-app scripts continue to provide only a semantic `UiIconName`.

Only these 15 host-selected names are reachable through the SDK mapping. Scripts cannot select arbitrary Lucide names.

- Primary button icons use the button's fixed inverse treatment.
- Destructive visible-action icons use the host danger treatment.
- Other action and list icons use the host's default or muted treatment.
- Leading list icons occupy a fixed host-controlled alignment area.
- Primary row-action icons appear in a trailing accessory area without squeezing the title at large Android font sizes.

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

Install dependencies and run repository checks:

```powershell
pnpm install
pnpm format
pnpm check
```

The font-backed renderer adds no native Android view manager. Once the existing embedded QuickJS changes have passed the connected suite, changes limited to the icon package, mapping, or fixture require only the repository checks and device acceptance.

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

1. All 15 icon names have distinct, readable, visually consistent Lucide presentations.
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
