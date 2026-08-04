import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";

import {
  cancelAllToolNotifications,
  describeNotificationTrigger,
  listToolNotificationEntries,
} from "../notifications/host-notifications.ts";
import type { InstalledMiniApp } from "../storage/database.ts";
import type { NotificationRegistryEntry } from "../storage/notification-registry.ts";
import { ErrorNotice } from "./ErrorNotice.tsx";
import { ScreenScrollView } from "./ScreenScrollView.tsx";
import { colors, radii, spacing } from "./theme.ts";

export interface ToolNotificationSettingsProps {
  readonly app: InstalledMiniApp;
  readonly onBack: () => void;
}

export function ToolNotificationSettings({ app, onBack }: ToolNotificationSettingsProps) {
  const [entries, setEntries] = useState<readonly NotificationRegistryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setEntries(await listToolNotificationEntries(app.id));
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [app.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const cancelAll = useCallback(() => {
    Alert.alert(
      `Cancel reminders for ${app.name}?`,
      "This removes every desired reminder for this tool.",
      [
        { text: "Keep reminders", style: "cancel" },
        {
          text: "Cancel all",
          style: "destructive",
          onPress: () => {
            void (async () => {
              try {
                await cancelAllToolNotifications(app.id);
                await refresh();
              } catch (caught) {
                setError(errorMessage(caught));
              }
            })();
          },
        },
      ],
    );
  }, [app.id, app.name, refresh]);

  const desired = entries.filter((entry) => entry.desired);

  return (
    <ScreenScrollView contentContainerStyle={styles.content}>
      <View style={styles.toolbar}>
        <Pressable accessibilityRole="button" onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
        <View style={styles.titleCopy}>
          <Text numberOfLines={1} style={styles.title}>
            Reminders
          </Text>
          <Text numberOfLines={1} style={styles.subtitle}>
            {app.name}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator />
          <Text style={styles.muted}>Loading reminders…</Text>
        </View>
      ) : null}

      {!loading && desired.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No reminders</Text>
          <Text style={styles.muted}>This tool does not currently own any desired reminders.</Text>
        </View>
      ) : null}

      {desired.map((entry) => (
        <View key={entry.notificationId} style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.reminderTitle}>{entry.request?.title ?? entry.notificationId}</Text>
            <Text style={styles.status}>{statusLabel(entry)}</Text>
          </View>
          {entry.request === undefined ? null : (
            <Text style={styles.muted}>{describeNotificationTrigger(entry.request)}</Text>
          )}
          {entry.request?.body === undefined || entry.request.body.length === 0 ? null : (
            <Text style={styles.body}>{entry.request.body}</Text>
          )}
          {entry.lastError === undefined ? null : (
            <Text style={styles.errorText}>{entry.lastError}</Text>
          )}
        </View>
      ))}

      {desired.length === 0 ? null : (
        <Pressable
          accessibilityRole="button"
          onPress={cancelAll}
          style={({ pressed }) => [styles.cancelButton, pressed ? styles.pressed : null]}
        >
          <Text style={styles.cancelText}>Cancel all reminders</Text>
        </Pressable>
      )}

      {error === null ? null : (
        <ErrorNotice
          detail={error}
          message="Return to notification settings and retry reconciliation."
          title="Reminders could not be loaded"
        />
      )}
    </ScreenScrollView>
  );
}

function statusLabel(entry: NotificationRegistryEntry): string {
  if (entry.status === "scheduled") return "Scheduled";
  if (entry.status === "blocked") return "Blocked";
  if (entry.status === "failed") return "Failed";
  return "Pending";
}

function errorMessage(caught: unknown): string {
  return caught instanceof Error ? caught.message : String(caught);
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.item,
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
    gap: 2,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "800",
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
  },
  loading: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.card,
    borderWidth: 1,
    gap: 6,
    padding: 16,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "700",
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.card,
    borderWidth: 1,
    gap: 7,
    padding: 16,
  },
  cardHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  reminderTitle: {
    color: colors.text,
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
  },
  status: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
  },
  body: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    lineHeight: 18,
  },
  muted: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  cancelButton: {
    alignSelf: "flex-start",
    backgroundColor: colors.surface,
    borderColor: colors.danger,
    borderRadius: radii.button,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  cancelText: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.72,
  },
});
