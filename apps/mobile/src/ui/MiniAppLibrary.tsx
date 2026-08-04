import { Pressable, StyleSheet, Text, View } from "react-native";

import type { InstalledMiniApp } from "../storage/database";
import { ProductHeader } from "./ProductHeader";
import { ScreenScrollView } from "./ScreenScrollView";
import { colors, radii, spacing } from "./theme";

export interface MiniAppLibraryProps {
  readonly apps: readonly InstalledMiniApp[];
  readonly onCreate: () => void;
  readonly onOpen: (app: InstalledMiniApp) => void;
  readonly onSettings: () => void;
}

export function MiniAppLibrary({ apps, onCreate, onOpen, onSettings }: MiniAppLibraryProps) {
  return (
    <ScreenScrollView contentContainerStyle={styles.content}>
      <ProductHeader onSettings={onSettings} />

      <Pressable
        accessibilityRole="button"
        onPress={onCreate}
        style={({ pressed }) => [styles.addButton, pressed ? styles.pressed : null]}
      >
        <Text style={styles.addButtonText}>Add tool</Text>
      </Pressable>

      {apps.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No tools yet</Text>
          <Text style={styles.emptyText}>Add a tool or restore one from Settings.</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {apps.map((app) => (
            <Pressable
              accessibilityRole="button"
              key={app.id}
              onPress={() => onOpen(app)}
              style={({ pressed }) => [styles.card, pressed ? styles.cardPressed : null]}
            >
              <View style={styles.cardCopy}>
                <Text style={styles.cardTitle}>{app.name}</Text>
                {app.description === undefined ? null : (
                  <Text numberOfLines={2} style={styles.cardDescription}>
                    {app.description}
                  </Text>
                )}
              </View>
              <Text accessibilityElementsHidden importantForAccessibility="no" style={styles.chevron}>
                ›
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.section,
    padding: spacing.screen,
    paddingBottom: 48,
  },
  addButton: {
    alignItems: "center",
    backgroundColor: colors.brand,
    borderRadius: radii.button,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 18,
  },
  addButtonText: {
    color: colors.surface,
    fontSize: 16,
    fontWeight: "800",
  },
  emptyCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.card,
    borderWidth: 1,
    gap: 6,
    padding: 28,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: "center",
  },
  list: {
    gap: spacing.item,
  },
  card: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.card,
    borderWidth: 1,
    flexDirection: "row",
    gap: 16,
    minHeight: 82,
    padding: 18,
  },
  cardPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  cardCopy: {
    flex: 1,
    gap: 5,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
  },
  cardDescription: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  chevron: {
    color: colors.textMuted,
    fontSize: 28,
  },
  pressed: {
    backgroundColor: colors.brandPressed,
  },
});
