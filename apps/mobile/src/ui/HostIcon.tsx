import AddSymbol from "@expo/material-symbols/add.xml";
import AttachMoneySymbol from "@expo/material-symbols/attach_money.xml";
import CalendarMonthSymbol from "@expo/material-symbols/calendar_month.xml";
import CheckSymbol from "@expo/material-symbols/check.xml";
import ContentCopySymbol from "@expo/material-symbols/content_copy.xml";
import DeleteSymbol from "@expo/material-symbols/delete.xml";
import EditSymbol from "@expo/material-symbols/edit.xml";
import FormatListBulletedSymbol from "@expo/material-symbols/format_list_bulleted.xml";
import InfoSymbol from "@expo/material-symbols/info.xml";
import RefreshSymbol from "@expo/material-symbols/refresh.xml";
import ScheduleSymbol from "@expo/material-symbols/schedule.xml";
import SearchSymbol from "@expo/material-symbols/search.xml";
import SettingsSymbol from "@expo/material-symbols/settings.xml";
import ShareSymbol from "@expo/material-symbols/share.xml";
import WarningSymbol from "@expo/material-symbols/warning.xml";
import { Icon } from "@expo/ui";
import type { ComponentProps } from "react";
import { StyleSheet, View, type ColorValue } from "react-native";

import type { UiIconName } from "../runtime/sdk12-icons.ts";

type ExpoIconSource = ComponentProps<typeof Icon>["name"];

const ICON_SOURCES: Readonly<Record<UiIconName, ExpoIconSource>> = {
  add: AddSymbol,
  edit: EditSymbol,
  delete: DeleteSymbol,
  check: CheckSymbol,
  calendar: CalendarMonthSymbol,
  clock: ScheduleSymbol,
  copy: ContentCopySymbol,
  share: ShareSymbol,
  search: SearchSymbol,
  settings: SettingsSymbol,
  warning: WarningSymbol,
  info: InfoSymbol,
  money: AttachMoneySymbol,
  list: FormatListBulletedSymbol,
  refresh: RefreshSymbol,
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
      style={[styles.icon, { height: dimension, width: dimension }]}
    >
      <Icon color={iconColor(tone)} name={ICON_SOURCES[name]} size={dimension} />
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
