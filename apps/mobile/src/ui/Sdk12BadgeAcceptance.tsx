import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { PageNode } from "../model.ts";
import { MiniAppRenderer } from "./MiniAppRenderer.tsx";

const badgePage = {
  type: "page",
  title: "Badge acceptance",
  children: [
    {
      type: "section",
      title: "Semantic tones",
      children: [
        {
          type: "row",
          children: [
            { type: "badge", text: "Default neutral" },
            { type: "badge", text: "Neutral", tone: "neutral" },
            { type: "badge", text: "Information", tone: "info" },
            { type: "badge", text: "Completed", tone: "success" },
            { type: "badge", text: "Needs attention", tone: "warning" },
            { type: "badge", text: "Blocked", tone: "danger" },
          ],
        },
      ],
    },
    {
      type: "section",
      title: "Layout and scaling",
      children: [
        {
          type: "column",
          children: [
            {
              type: "badge",
              text: "A longer informational badge should remain readable without clipping",
              tone: "info",
            },
            {
              type: "row",
              children: [
                { type: "badge", text: "Ready", tone: "success" },
                { type: "badge", text: "Review", tone: "warning" },
                { type: "badge", text: "Failed", tone: "danger" },
              ],
            },
          ],
        },
      ],
    },
  ],
} as unknown as PageNode;

const noop = () => Promise.resolve();

export function Sdk12BadgeAcceptance() {
  const [controlPresses, setControlPresses] = useState(0);

  return (
    <View style={styles.section}>
      <Text style={styles.eyebrow}>Temporary SDK 1.2 acceptance</Text>
      <Text style={styles.title}>Host-owned badges</Text>
      <Text style={styles.instructions}>
        Confirm every tone is distinct and readable, the long badge wraps without clipping, and the
        layout remains usable at larger Android font sizes. Badges are display-only: tapping them
        must not increment the control below.
      </Text>

      <MiniAppRenderer
        page={badgePage}
        settings={{}}
        settingValues={{}}
        timers={{}}
        onAction={noop}
        onNavigate={noop}
        onSettingChange={noop}
      />

      <Pressable
        accessibilityRole="button"
        onPress={() => setControlPresses((current) => current + 1)}
        style={styles.control}
      >
        <Text style={styles.controlText}>Interaction control: {controlPresses}</Text>
      </Pressable>
      <Text style={styles.instructions}>
        With TalkBack enabled, neutral badges should announce their text. Info, success, warning,
        and danger badges should also announce their semantic status.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: "#ffffff",
    borderColor: "#e4e7ec",
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
  eyebrow: {
    color: "#475467",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  title: {
    color: "#101828",
    fontSize: 20,
    fontWeight: "800",
  },
  instructions: {
    color: "#667085",
    fontSize: 14,
    lineHeight: 20,
  },
  control: {
    alignItems: "center",
    backgroundColor: "#172033",
    borderRadius: 11,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 14,
  },
  controlText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
});
