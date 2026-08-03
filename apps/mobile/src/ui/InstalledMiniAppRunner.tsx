import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import type { InstalledMiniApp } from "../storage/database";
import { MiniAppRuntimePanel } from "./MiniAppRuntimePanel";

export interface InstalledMiniAppRunnerProps {
  readonly app: InstalledMiniApp;
  readonly onBack: () => void;
  readonly onDuplicate: () => void;
  readonly onEdit: () => void;
  readonly onExport: () => void;
  readonly onRollback: () => void;
}

export function InstalledMiniAppRunner({
  app,
  onBack,
  onDuplicate,
  onEdit,
  onExport,
  onRollback,
}: InstalledMiniAppRunnerProps) {
  const canRollback = app.activeSource !== app.lastKnownGoodSource;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.toolbar}>
        <Pressable accessibilityRole="button" onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>Library</Text>
        </Pressable>
        <View style={styles.toolbarActions}>
          <ToolbarAction label="Edit" onPress={onEdit} />
          <ToolbarAction label="Duplicate" onPress={onDuplicate} />
          <ToolbarAction label="Export" onPress={onExport} />
          {canRollback ? (
            <ToolbarAction label="Roll back" onPress={onRollback} />
          ) : null}
        </View>
      </View>

      <MiniAppRuntimePanel source={app.activeSource} storageId={app.id} />
    </ScrollView>
  );
}

function ToolbarAction({
  label,
  onPress,
}: {
  readonly label: string;
  readonly onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.actionButton}>
      <Text style={styles.actionButtonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 16,
    padding: 18,
    paddingBottom: 48,
  },
  toolbar: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "space-between",
  },
  backButton: {
    backgroundColor: "#ffffff",
    borderColor: "#d0d5dd",
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  backButtonText: {
    color: "#344054",
    fontSize: 14,
    fontWeight: "700",
  },
  toolbarActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  actionButton: {
    backgroundColor: "#172033",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  actionButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
});
