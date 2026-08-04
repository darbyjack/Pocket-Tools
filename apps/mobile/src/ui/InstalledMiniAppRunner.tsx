import { Pressable, StyleSheet, Text, View } from "react-native";

import type { SerializableValue } from "../model";
import type { InstalledMiniApp } from "../storage/database";
import { MiniAppRuntimePanel } from "./MiniAppRuntimePanel";
import { ScreenScrollView } from "./ScreenScrollView";
import { colors, radii, spacing } from "./theme";

export interface InstalledMiniAppRunnerProps {
  readonly app: InstalledMiniApp;
  readonly initialScreen?: string | undefined;
  readonly initialScreenInput?: SerializableValue | undefined;
  readonly onBack: () => void;
  readonly onManage: () => void;
}

export function InstalledMiniAppRunner({
  app,
  initialScreen = "home",
  initialScreenInput,
  onBack,
  onManage,
}: InstalledMiniAppRunnerProps) {
  return (
    <ScreenScrollView contentContainerStyle={styles.content}>
      <View style={styles.toolbar}>
        <Pressable accessibilityRole="button" onPress={onBack} style={styles.toolbarButton}>
          <Text style={styles.toolbarButtonText}>Back</Text>
        </Pressable>
        <Text numberOfLines={1} style={styles.title}>
          {app.name}
        </Text>
        <Pressable accessibilityRole="button" onPress={onManage} style={styles.toolbarButton}>
          <Text style={styles.toolbarButtonText}>Manage</Text>
        </Pressable>
      </View>

      <MiniAppRuntimePanel
        initialScreen={initialScreen}
        {...(initialScreenInput === undefined ? {} : { initialScreenInput })}
        source={app.activeSource}
        storageId={app.id}
      />
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.item,
    padding: spacing.screen,
    paddingBottom: 48,
  },
  toolbar: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  title: {
    color: colors.text,
    flex: 1,
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
  },
  toolbarButton: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.button,
    borderWidth: 1,
    minWidth: 70,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  toolbarButtonText: {
    color: colors.brand,
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },
});
