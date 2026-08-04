import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import {
  getHostNotificationStatus,
  openHostExactAlarmSettings,
  openHostNotificationSettings,
  reconcileHostNotifications,
  requestHostNotificationPermission,
  type HostNotificationStatus,
} from "../notifications/host-notifications.ts";
import { ErrorNotice } from "./ErrorNotice.tsx";
import { ScreenScrollView } from "./ScreenScrollView.tsx";
import { colors, radii, spacing } from "./theme.ts";

export interface NotificationSettingsProps {
  readonly onBack: () => void;
}

export function NotificationSettings({ onBack }: NotificationSettingsProps) {
  const [status, setStatus] = useState<HostNotificationStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      setStatus(await getHostNotificationStatus());
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const run = useCallback(
    async (action: () => Promise<unknown>) => {
      setBusy(true);
      setError(null);
      try {
        await action();
        await reconcileHostNotifications();
        setStatus(await getHostNotificationStatus());
      } catch (caught) {
        setError(errorMessage(caught));
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  return (
    <ScreenScrollView contentContainerStyle={styles.content}>
      <View style={styles.toolbar}>
        <Pressable accessibilityRole="button" onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
        <Text style={styles.title}>Notifications</Text>
      </View>

      {status === null && busy ? (
        <View style={styles.loading}>
          <ActivityIndicator />
          <Text style={styles.muted}>Checking Android notification settings…</Text>
        </View>
      ) : null}

      {status === null ? null : (
        <>
          <View style={styles.card}>
            <StatusRow label="Permission" value={permissionLabel(status)} />
            <StatusRow
              label="Reminders channel"
              value={status.notificationsEnabled ? "Enabled" : "Blocked"}
            />
            <StatusRow
              label="Exact reminders"
              value={status.exactAlarmAccess ? "Allowed" : "Access needed"}
            />
          </View>

          <View style={styles.card}>
            <StatusRow label="Desired reminders" value={String(status.desired)} />
            <StatusRow label="Scheduled" value={String(status.scheduled)} />
            <StatusRow label="Blocked" value={String(status.blocked)} />
            <StatusRow label="Failed" value={String(status.failed)} />
          </View>

          <View style={styles.actions}>
            {status.permission !== "granted" ? (
              <ActionButton
                disabled={busy}
                label="Allow notifications"
                onPress={() => void run(requestHostNotificationPermission)}
                primary
              />
            ) : null}
            <ActionButton
              disabled={busy}
              label="Android notification settings"
              onPress={() => void run(openHostNotificationSettings)}
            />
            {!status.exactAlarmAccess ? (
              <ActionButton
                disabled={busy}
                label="Allow exact reminders"
                onPress={() => void run(openHostExactAlarmSettings)}
              />
            ) : null}
            <ActionButton
              disabled={busy}
              label="Retry reminders"
              onPress={() => void run(reconcileHostNotifications)}
            />
          </View>
        </>
      )}

      {error === null ? null : (
        <ErrorNotice
          detail={error}
          message="Review Android notification settings, then try again."
          title="Notification settings could not be updated"
        />
      )}

      <Text style={styles.muted}>
        Pocket Tools owns one reminders channel. Individual tools cannot choose channels, sounds,
        vibration patterns, or watch delivery.
      </Text>
    </ScreenScrollView>
  );
}

function StatusRow({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <View style={styles.statusRow}>
      <Text style={styles.statusLabel}>{label}</Text>
      <Text style={styles.statusValue}>{value}</Text>
    </View>
  );
}

function ActionButton({
  disabled,
  label,
  onPress,
  primary = false,
}: {
  readonly disabled: boolean;
  readonly label: string;
  readonly onPress: () => void;
  readonly primary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        primary ? styles.primaryButton : null,
        disabled ? styles.disabled : null,
        pressed && !disabled ? styles.pressed : null,
      ]}
    >
      <Text style={[styles.actionText, primary ? styles.primaryText : null]}>{label}</Text>
    </Pressable>
  );
}

function permissionLabel(status: HostNotificationStatus): string {
  if (status.permission === "undetermined") return "Not requested";
  if (status.permission === "denied") return "Denied";
  return "Granted";
}

function errorMessage(caught: unknown): string {
  return caught instanceof Error ? caught.message : String(caught);
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
  loading: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.card,
    borderWidth: 1,
    overflow: "hidden",
  },
  statusRow: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 12,
    minHeight: 50,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  statusLabel: {
    color: colors.text,
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
  },
  statusValue: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "600",
  },
  actions: {
    alignItems: "flex-start",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9,
  },
  actionButton: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.button,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  primaryButton: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  actionText: {
    color: colors.brand,
    fontSize: 14,
    fontWeight: "700",
  },
  primaryText: {
    color: colors.surface,
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.72,
  },
  muted: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
});
