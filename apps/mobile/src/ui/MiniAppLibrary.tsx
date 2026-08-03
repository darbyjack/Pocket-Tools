import { Pressable, StyleSheet, Text, View } from "react-native";

import type { InstalledMiniApp } from "../storage/database";
import { ScreenScrollView } from "./ScreenScrollView";

export interface MiniAppLibraryProps {
  readonly apps: readonly InstalledMiniApp[];
  readonly onCreate: () => void;
  readonly onDelete: (app: InstalledMiniApp) => void;
  readonly onDiagnostics: () => void;
  readonly onDuplicate: (app: InstalledMiniApp) => void;
  readonly onEdit: (app: InstalledMiniApp) => void;
  readonly onExport: (app: InstalledMiniApp) => void;
  readonly onOpen: (app: InstalledMiniApp) => void;
  readonly onRestore: () => void;
}

export function MiniAppLibrary({
  apps,
  onCreate,
  onDelete,
  onDiagnostics,
  onDuplicate,
  onEdit,
  onExport,
  onOpen,
  onRestore,
}: MiniAppLibraryProps) {
  return (
    <ScreenScrollView contentContainerStyle={styles.content}>
      <View style={styles.headingRow}>
        <View style={styles.headingCopy}>
          <Text style={styles.eyebrow}>Pocket Tools</Text>
          <Text style={styles.title}>Mini-app library</Text>
          <Text style={styles.subtitle}>
            Every installed script is offline and receives only isolated settings, records, and
            durable timers.
          </Text>
        </View>
        <View style={styles.headingActions}>
          <Pressable accessibilityRole="button" onPress={onCreate} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Add script</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={onRestore} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Restore backup</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={onDiagnostics}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>Host diagnostics</Text>
          </Pressable>
        </View>
      </View>

      {apps.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No mini apps installed</Text>
          <Text style={styles.emptyText}>
            Paste an agent-generated SDK v1 script or restore a portable backup without rebuilding
            Pocket Tools.
          </Text>
          <View style={styles.headingActions}>
            <Pressable accessibilityRole="button" onPress={onCreate} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Paste your first script</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={onRestore}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>Restore backup</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.list}>
          {apps.map((app) => (
            <View key={app.id} style={styles.card}>
              <Pressable
                accessibilityRole="button"
                onPress={() => onOpen(app)}
                style={styles.cardMain}
              >
                <View style={styles.cardCopy}>
                  <Text style={styles.cardTitle}>{app.name}</Text>
                  <Text style={styles.cardId}>{app.id}</Text>
                  {app.description === undefined ? null : (
                    <Text style={styles.cardDescription}>{app.description}</Text>
                  )}
                </View>
                <Text style={styles.openLabel}>Open</Text>
              </Pressable>

              <View style={styles.actions}>
                <Action label="Edit" onPress={() => onEdit(app)} />
                <Action label="Duplicate" onPress={() => onDuplicate(app)} />
                <Action label="Export" onPress={() => onExport(app)} />
                <Action destructive label="Remove" onPress={() => onDelete(app)} />
              </View>
            </View>
          ))}
        </View>
      )}
    </ScreenScrollView>
  );
}

function Action({
  destructive = false,
  label,
  onPress,
}: {
  readonly destructive?: boolean;
  readonly label: string;
  readonly onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.actionButton}>
      <Text style={[styles.actionButtonText, destructive ? styles.destructiveText : null]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 20,
    padding: 18,
    paddingBottom: 48,
  },
  headingRow: {
    alignItems: "flex-start",
    gap: 16,
  },
  headingCopy: {
    gap: 5,
  },
  headingActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9,
  },
  eyebrow: {
    color: "#475467",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  title: {
    color: "#101828",
    fontSize: 28,
    fontWeight: "800",
  },
  subtitle: {
    color: "#475467",
    fontSize: 15,
    lineHeight: 21,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#172033",
    borderRadius: 12,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#d0d5dd",
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    color: "#344054",
    fontSize: 14,
    fontWeight: "700",
  },
  emptyCard: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 18,
    gap: 12,
    padding: 28,
  },
  emptyTitle: {
    color: "#101828",
    fontSize: 19,
    fontWeight: "800",
  },
  emptyText: {
    color: "#667085",
    fontSize: 15,
    lineHeight: 21,
    textAlign: "center",
  },
  list: {
    gap: 14,
  },
  card: {
    backgroundColor: "#ffffff",
    borderColor: "#e4e7ec",
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
  },
  cardMain: {
    alignItems: "center",
    flexDirection: "row",
    gap: 16,
    justifyContent: "space-between",
    padding: 18,
  },
  cardCopy: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    color: "#101828",
    fontSize: 18,
    fontWeight: "800",
  },
  cardId: {
    color: "#667085",
    fontFamily: "monospace",
    fontSize: 12,
  },
  cardDescription: {
    color: "#475467",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 3,
  },
  openLabel: {
    color: "#175cd3",
    fontSize: 14,
    fontWeight: "700",
  },
  actions: {
    borderTopColor: "#eaecf0",
    borderTopWidth: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  actionButton: {
    paddingHorizontal: 9,
    paddingVertical: 8,
  },
  actionButtonText: {
    color: "#344054",
    fontSize: 13,
    fontWeight: "700",
  },
  destructiveText: {
    color: "#b42318",
  },
});
