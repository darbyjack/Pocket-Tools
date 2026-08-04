import { Pressable, StyleSheet, Text, View } from "react-native";

import type { InstalledMiniApp } from "../storage/database";
import { ScreenScrollView } from "./ScreenScrollView";
import { colors, radii, spacing } from "./theme";

export interface MiniAppManagementProps {
  readonly app: InstalledMiniApp;
  readonly onBack: () => void;
  readonly onBackup: () => void;
  readonly onDelete: () => void;
  readonly onDuplicate: () => void;
  readonly onEdit: () => void;
  readonly onExport: () => void;
  readonly onRollback: () => void;
}

export function MiniAppManagement({
  app,
  onBack,
  onBackup,
  onDelete,
  onDuplicate,
  onEdit,
  onExport,
  onRollback,
}: MiniAppManagementProps) {
  const canRollback = app.activeSource !== app.lastKnownGoodSource;

  return (
    <ScreenScrollView contentContainerStyle={styles.content}>
      <View style={styles.toolbar}>
        <Pressable accessibilityRole="button" onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
        <View style={styles.titleCopy}>
          <Text numberOfLines={1} style={styles.title}>
            {app.name}
          </Text>
          {app.description === undefined ? null : (
            <Text numberOfLines={2} style={styles.description}>
              {app.description}
            </Text>
          )}
        </View>
      </View>

      <ManagementSection title="Tool">
        <ManagementRow label="Edit" onPress={onEdit} />
        <ManagementRow label="Duplicate" onPress={onDuplicate} />
      </ManagementSection>

      <ManagementSection title="Data">
        <ManagementRow label="Export script" onPress={onExport} />
        <ManagementRow label="Back up tool" onPress={onBackup} />
      </ManagementSection>

      {canRollback ? (
        <ManagementSection title="Recovery">
          <ManagementRow label="Roll back" onPress={onRollback} />
        </ManagementSection>
      ) : null}

      <ManagementSection title="Remove">
        <ManagementRow destructive label="Remove tool" onPress={onDelete} />
      </ManagementSection>
    </ScreenScrollView>
  );
}

function ManagementSection({
  children,
  title,
}: {
  readonly children: React.ReactNode;
  readonly title: string;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

function ManagementRow({
  destructive = false,
  label,
  onPress,
}: {
  readonly destructive?: boolean;
  readonly label: string;
  readonly onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
    >
      <Text style={[styles.rowLabel, destructive ? styles.destructiveLabel : null]}>{label}</Text>
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
    alignItems: "flex-start",
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
  titleCopy: {
    flex: 1,
    gap: 4,
    paddingTop: 2,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "800",
  },
  description: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
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
  destructiveLabel: {
    color: colors.danger,
  },
  chevron: {
    color: colors.textMuted,
    fontSize: 24,
  },
  pressed: {
    backgroundColor: colors.surfaceMuted,
  },
});
