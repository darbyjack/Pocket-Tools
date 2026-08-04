import { StyleSheet, Text } from "react-native";

import type { UiIconName } from "../runtime/sdk12-icons.ts";

const ICON_GLYPHS: Readonly<Record<UiIconName, string>> = {
  add: "+",
  edit: "✎",
  delete: "×",
  check: "✓",
  calendar: "▦",
  clock: "◷",
  copy: "⧉",
  share: "↗",
  search: "⌕",
  settings: "⚙︎",
  warning: "!",
  info: "i",
  money: "$",
  list: "≡",
  refresh: "↻",
};

export type HostIconTone = "default" | "inverse" | "danger" | "muted";

interface HostIconProps {
  readonly name: UiIconName;
  readonly size?: "small" | "medium";
  readonly tone?: HostIconTone;
}

export function HostIcon({ name, size = "medium", tone = "default" }: HostIconProps) {
  return (
    <Text
      accessibilityElementsHidden
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.icon,
        size === "small" ? styles.small : styles.medium,
        tone === "inverse"
          ? styles.inverse
          : tone === "danger"
            ? styles.danger
            : tone === "muted"
              ? styles.muted
              : styles.default,
      ]}
    >
      {ICON_GLYPHS[name]}
    </Text>
  );
}

const styles = StyleSheet.create({
  icon: {
    flexShrink: 0,
    fontWeight: "900",
    textAlign: "center",
  },
  small: {
    fontSize: 16,
    lineHeight: 18,
    width: 18,
  },
  medium: {
    fontSize: 19,
    lineHeight: 22,
    width: 22,
  },
  default: {
    color: "#344054",
  },
  inverse: {
    color: "#ffffff",
  },
  danger: {
    color: "#b42318",
  },
  muted: {
    color: "#667085",
  },
});
