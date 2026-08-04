import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import type { PageNode, SerializableValue } from "../model.ts";
import { UI_ICON_NAMES } from "../runtime/sdk12-icons.ts";
import { MiniAppRenderer } from "./MiniAppRenderer.tsx";

const iconButtons = UI_ICON_NAMES.map((icon) => ({
  type: "button" as const,
  label: icon,
  action: "tapIcon",
  input: icon,
  icon,
}));

const acceptancePage = {
  type: "page",
  title: "Host-owned icons",
  children: [
    {
      type: "section",
      title: "All 15 fixed icons",
      children: [
        {
          type: "row",
          children: iconButtons,
        },
      ],
    },
    {
      type: "section",
      title: "States and wrapping",
      children: [
        {
          type: "button",
          label: "A long labeled action that should remain readable at large font sizes",
          action: "tapIcon",
          input: "long-label",
          icon: "info",
        },
        {
          type: "button",
          label: "Disabled warning action",
          action: "disabledIcon",
          icon: "warning",
          disabled: true,
        },
        {
          type: "button",
          label: "Delete with confirmation",
          action: "deleteConfirmed",
          icon: "delete",
          intent: "destructive",
          confirmation: {
            title: "Confirm destructive icon action",
            message: "The host must retain the normal confirmation flow.",
          },
        },
      ],
    },
    {
      type: "section",
      title: "List placements and action isolation",
      children: [
        {
          type: "list",
          items: [
            {
              type: "list-item",
              title: "Appointment",
              subtitle: "Tap the row, then each visible action.",
              trailing: "10:30 AM",
              leadingIcon: "calendar",
              primaryAction: {
                label: "Open appointment",
                action: "openAppointment",
                icon: "edit",
              },
              actions: [
                {
                  label: "Refresh",
                  action: "refreshAppointment",
                  icon: "refresh",
                },
                {
                  label: "Copy",
                  action: "copyAppointment",
                  icon: "copy",
                },
                {
                  label: "Delete",
                  action: "deleteAppointment",
                  icon: "delete",
                  intent: "destructive",
                  confirmation: { title: "Delete appointment?" },
                },
              ],
            },
            {
              type: "list-item",
              title: "Monthly budget",
              subtitle: "Leading icons remain decorative.",
              trailing: "$1,250",
              leadingIcon: "money",
            },
          ],
        },
      ],
    },
  ],
} as unknown as PageNode;

export function Sdk12IconsAcceptance() {
  const [primaryCount, setPrimaryCount] = useState(0);
  const [visibleCount, setVisibleCount] = useState(0);
  const [lastAction, setLastAction] = useState("None");

  const onAction = async (action: string, input?: SerializableValue) => {
    if (action === "openAppointment") {
      setPrimaryCount((current) => current + 1);
    } else if (
      action === "refreshAppointment" ||
      action === "copyAppointment" ||
      action === "deleteAppointment"
    ) {
      setVisibleCount((current) => current + 1);
    }
    setLastAction(input === undefined ? action : `${action}: ${String(input)}`);
  };

  return (
    <View style={styles.fixture}>
      <View style={styles.heading}>
        <Text style={styles.eyebrow}>Temporary SDK 1.2 acceptance</Text>
        <Text style={styles.instructions}>
          Verify icon identity, wrapping, disabled and destructive states, row-action isolation,
          lifecycle recovery, and TalkBack labels. Icons must never be announced separately.
        </Text>
      </View>

      <View accessible accessibilityLabel={`Primary row actions ${primaryCount}. Visible actions ${visibleCount}. Last action ${lastAction}.`} style={styles.counter}>
        <Text style={styles.counterTitle}>Interaction counters</Text>
        <Text style={styles.counterText}>Primary row actions: {primaryCount}</Text>
        <Text style={styles.counterText}>Visible actions: {visibleCount}</Text>
        <Text style={styles.counterText}>Last action: {lastAction}</Text>
      </View>

      <MiniAppRenderer
        page={acceptancePage}
        settings={{}}
        settingValues={{}}
        timers={{}}
        onAction={onAction}
        onNavigate={async () => undefined}
        onSettingChange={async () => undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fixture: {
    borderColor: "#b2ddff",
    borderRadius: 18,
    borderWidth: 2,
    gap: 16,
    padding: 16,
  },
  heading: {
    gap: 5,
  },
  eyebrow: {
    color: "#175cd3",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  instructions: {
    color: "#344054",
    fontSize: 14,
    lineHeight: 20,
  },
  counter: {
    backgroundColor: "#eff8ff",
    borderRadius: 12,
    gap: 3,
    padding: 12,
  },
  counterTitle: {
    color: "#1849a9",
    fontSize: 14,
    fontWeight: "800",
  },
  counterText: {
    color: "#175cd3",
    fontSize: 13,
  },
});
