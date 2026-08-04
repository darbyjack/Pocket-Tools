import { Lucide } from "@react-native-vector-icons/lucide";
import type { ComponentProps } from "react";
import { StyleSheet, View } from "react-native";

import type { UiIconName } from "../runtime/sdk12-icons.ts";

type LucideName = ComponentProps<typeof Lucide>["name"];

const ICON_NAMES: Readonly<Record<UiIconName, LucideName>> = {
  add: "plus",
  edit: "pencil",
  delete: "trash-2",
  check: "check",
  calendar: "calendar",
  clock: "clock",
  copy: "copy",
  share: "share-2",
  search: "search",
  settings: "settings",
  warning: "triangle-alert",
  info: "info",
  money: "dollar-sign",
  list: "list",
  refresh: "refresh-cw",
};

export type HostIconTone = "default" | "inverse" | "danger" | "muted";

interface HostIconProps {
  readonly name: UiIconName;
  readonly size?: "small" | "medium";
  readonly tone?: HostIconTone;
}

export function HostIcon({ name, size = "medium", tone = "default" }: HostIconProps) {
  const dimension = size === "small" ? 18 : 22;

  return (
    <View
      accessibilityElementsHidden
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[styles.icon, { height: dimension, width: dimension }]}
    >
      <Lucide color={iconColor(tone)} name={ICON_NAMES[name]} size={dimension} />
    </View>
  );
}

function iconColor(tone: HostIconTone): string {
  switch (tone) {
    case "inverse":
      return "#ffffff";
    case "danger":
      return "#b42318";
    case "muted":
      return "#667085";
    case "default":
      return "#344054";
  }
}

const styles = StyleSheet.create({
  icon: {
    alignItems: "center",
    flexShrink: 0,
    justifyContent: "center",
  },
});
