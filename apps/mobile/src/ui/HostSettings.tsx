import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { OpenSourceLicenses } from "./OpenSourceLicenses";
import { ScreenScrollView } from "./ScreenScrollView";
import { colors, radii, spacing } from "./theme";

export interface HostSettingsProps {
  readonly onBack: () => void;
  readonly onBackupAll: () => void;
  readonly onDiagnostics: () => void;
  readonly onNotifications: () => void;
  readonly onRestoreAll: () => void;
  readonly onRestoreOne: () => void;
}

export function HostSettings({
  onBack,
  onBackupAll,
  onDiagnostics,
  onNotifications,
  onRestoreAll,
  onRestoreOne,
}: HostSettingsProps) {
  const [showOpenSourceLicenses, setShowOpenSourceLicenses] = useState(false);

  if (showOpenSourceLicenses) {
    return <OpenSourceLicenses onBack={() => setShowOpenSourceLicenses(false)} />;
  }

  return (
    <ScreenScrollView contentContainerStyle={styles.content}>
      <View style={styles.toolbar}>
        <Pressable accessibilityRole="button" onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
        <Text style={styles.title}>Settings</Text>
      </View>

      <SettingsSection title="Notifications">
        <SettingsRow label="Notification settings" onPress={onNotifications} />
      </SettingsSection>

      <SettingsSection title="Data">
        <SettingsRow label="Back up everything" onPress={onBackupAll} />
        <SettingsRow label="Restore a tool" onPress={onRestoreOne} />
        <SettingsRow label="Restore everything" onPress={onRestoreAll} />
      </SettingsSection>

      <SettingsSection title="Advanced">
        <SettingsRow label="Diagnostics" onPress={onDiagnostics} />
      </SettingsSection>

      <SettingsSection title="About">
        <SettingsRow
          label="Open-source licenses"
          onPress={() => setShowOpenSourceLicenses(true)}
        />
      </SettingsSection>
    </ScreenScrollView>
  );
}

function SettingsSection({
  children,
  title,
}: {
  readonly children: ReactNode;
  readonly title: string;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

function SettingsRow({ label, onPress }: { readonly label: string; readonly onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
    >
      <Text style={styles.rowLabel}>{label}</Text>
      <Text accessibilityElementsHidden importantForAccessibility="no" style={styles.chevron}>
        ›
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.section,
    padding: spacing.screen,
    paddingBottom: 48,
  },
  toolbar: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
  },
  backButton: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.button,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  backButtonText: {
    color: colors.brand,
    fontSize: 14,
    fontWeight: "700",
  },
  title: {
    color: colors.text,
    flex: 1,
    fontSize: 24,
    fontWeight: "800",
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.card,
    borderWidth: 1,
    overflow: "hidden",
  },
  row: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 12,
    minHeight: 54,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  rowLabel: {
    color: colors.text,
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
  },
  chevron: {
    color: colors.textMuted,
    fontSize: 24,
  },
  pressed: {
    backgroundColor: colors.surfaceMuted,
  },
});
