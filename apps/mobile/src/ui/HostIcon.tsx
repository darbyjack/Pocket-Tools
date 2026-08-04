import {
  CalendarDays,
  Check,
  Clock3,
  Copy,
  DollarSign,
  Info,
  List as ListIcon,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Share2,
  Trash2,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react-native";
import { StyleSheet, View, type ColorValue } from "react-native";

import type { UiIconName } from "../runtime/sdk12-icons.ts";

const ICONS: Readonly<Record<UiIconName, LucideIcon>> = {
  add: Plus,
  edit: Pencil,
  delete: Trash2,
  check: Check,
  calendar: CalendarDays,
  clock: Clock3,
  copy: Copy,
  share: Share2,
  search: Search,
  settings: Settings,
  warning: TriangleAlert,
  info: Info,
  money: DollarSign,
  list: ListIcon,
  refresh: RefreshCw,
};

export type HostIconTone = "default" | "inverse" | "danger" | "muted";

interface HostIconProps {
  readonly name: UiIconName;
  readonly size?: "small" | "medium";
  readonly tone?: HostIconTone;
}

export function HostIcon({ name, size = "medium", tone = "default" }: HostIconProps) {
  const IconComponent = ICONS[name];
  const dimension = size === "small" ? 18 : 22;

  return (
    <View
      accessibilityElementsHidden
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[styles.icon, { height: dimension, width: dimension }]}
    >
      <IconComponent color={iconColor(tone)} size={dimension} strokeWidth={2.25} />
    </View>
  );
}

function iconColor(tone: HostIconTone): ColorValue {
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
