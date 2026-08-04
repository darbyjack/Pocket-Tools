import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { PageNode } from "../model.ts";
import { MiniAppRenderer } from "./MiniAppRenderer.tsx";

const progressPage = {
  type: "page",
  title: "Progress acceptance",
  children: [
    {
      type: "section",
      title: "Ranges and formats",
      children: [
        {
          type: "progress",
          label: "Default range",
          value: 25,
          format: "percent",
        },
        {
          type: "progress",
          label: "Nonzero range",
          value: 20,
          min: 10,
          max: 30,
          format: "percent",
        },
        {
          type: "progress",
          label: "Number format",
          value: 7,
          min: 0,
          max: 10,
          format: "number",
        },
      ],
    },
    {
      type: "section",
      title: "Visual clamping",
      children: [
        {
          type: "progress",
          label: "Below minimum: original value -10",
          value: -10,
          min: 0,
          max: 100,
          format: "number",
        },
        {
          type: "progress",
          label: "Above maximum: original value 125",
          value: 125,
          min: 0,
          max: 100,
          format: "number",
        },
      ],
    },
    {
      type: "section",
      title: "Layout and accessibility",
      children: [
        {
          type: "progress",
          value: 40,
          format: "percent",
        },
        {
          type: "progress",
          label:
            "A long progress label should wrap cleanly without clipping the value or progress track",
          value: 60,
          format: "percent",
        },
      ],
    },
  ],
} as unknown as PageNode;

const noop = async () => undefined;

export function Sdk12ProgressAcceptance() {
  const [controlPresses, setControlPresses] = useState(0);

  return (
    <View style={styles.section}>
      <Text style={styles.eyebrow}>Temporary SDK 1.2 acceptance</Text>
      <Text style={styles.title}>Host-owned progress</Text>
      <Text style={styles.instructions}>
        Confirm each fill matches its displayed percentage, below-min is visually empty, above-max
        is visually full, original out-of-range values remain visible, and large font sizes do not
        clip labels, values, or tracks. Progress bars are display-only.
      </Text>

      <MiniAppRenderer
        page={progressPage}
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
        Tapping progress bars must not increment the control. With TalkBack enabled, verify the
        label, original value, declared minimum and maximum, and percent-through-range are announced.
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
