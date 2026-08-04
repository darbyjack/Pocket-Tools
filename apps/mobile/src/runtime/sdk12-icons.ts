import type { ActionControl, ListItemNode } from "../model.ts";

export const UI_ICON_NAMES = [
  "add",
  "edit",
  "delete",
  "check",
  "calendar",
  "clock",
  "copy",
  "share",
  "search",
  "settings",
  "warning",
  "info",
  "money",
  "list",
  "refresh",
] as const;

export type UiIconName = (typeof UI_ICON_NAMES)[number];

export interface DormantIconActionControl extends ActionControl {
  readonly icon?: UiIconName;
}

export interface DormantIconListItemNode extends Omit<ListItemNode, "primaryAction" | "actions"> {
  readonly leadingIcon?: UiIconName;
  readonly primaryAction?: DormantIconActionControl;
  readonly actions?: readonly DormantIconActionControl[];
}

export function hasUiIconName(value: unknown): value is UiIconName {
  return typeof value === "string" && (UI_ICON_NAMES as readonly string[]).includes(value);
}
