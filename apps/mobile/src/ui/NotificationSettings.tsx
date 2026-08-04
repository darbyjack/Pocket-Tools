import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, AppState, Pressable, StyleSheet, Text, View } from "react-native";

import {
  cancelNotificationAcceptance,
  getNotificationAcceptanceStatus,
  installNotificationAcceptanceFixture,
  removeNotificationAcceptanceFixture,
  scheduleNotificationAcceptance,
  type NotificationAcceptanceKind,
  type NotificationAcceptanceStatus,
} from "../diagnostics/notifications.ts";
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
  const [acceptance, setAcceptance] = useState<NotificationAcceptanceStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const [nextStatus, nextAcceptance] = await Promise.all([
        getHostNotificationStatus(),
        getNotificationAcceptanceStatus(),
      ]);
      setStatus(nextStatus);
      setAcceptance(nextAcceptance);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      void reconcileHostNotifications()
        .then(refresh)
        .catch((caught: unknown) => setError(errorMessage(caught)));
    });
    return () => subscription.remove();
  }, [refresh]);

  const run = useCallback(async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      await reconcileHostNotifications();
      const [nextStatus, nextAcceptance] = await Promise.all([
        getHostNotificationStatus(),
        getNotificationAcceptanceStatus(),
      ]);
      setStatus(nextStatus);
      setAcceptance(nextAcceptance);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }, []);

  const scheduleAcceptance = useCallback(
    (kind: NotificationAcceptanceKind) => {
      void run(() => scheduleNotificationAcceptance(kind));
    },
    [run],
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

      {acceptance === null ? null : (
        <View style={styles.acceptanceCard}>
          <Text style={styles.acceptanceTitle}>Temporary physical acceptance</Text>
          <Text style={styles.muted}>
            These controls create a removable internal tool and exercise the committed SQLite to
            Android delivery path. They do not enable SDK 1.2 installation or authoring.
          </Text>
          <StatusRow
            label="Acceptance tool"
            value={acceptance.installed ? "Installed" : "Not installed"}
          />
          <StatusRow label="Tool registry rows" value={String(acceptance.entries.length)} />

          {acceptance.entries.length === 0 ? null : (
            <View style={styles.entryList}>
              {acceptance.entries.map((entry) => (
                <Text key={entry.notificationId} selectable style={styles.entryText}>
                  {entry.notificationId}: {entry.desired ? entry.status : "cancelling"}
                </Text>
              ))}
            </View>
          )}

          <View style={styles.actions}>
            {!acceptance.installed ? (
              <ActionButton
                disabled={busy}
                label="Install acceptance tool"
                onPress={() => void run(installNotificationAcceptanceFixture)}
                primary
              />
            ) : (
              <>
                <ActionButton
                  disabled={busy}
                  label="Immediate"
                  onPress={() => scheduleAcceptance("immediate")}
                  primary
                />
                <ActionButton
                  disabled={busy}
                  label="Standard +2 min"
                  onPress={() => scheduleAcceptance("standardDate")}
                />
                <ActionButton
                  disabled={busy}
                  label="Exact +3 min"
                  onPress={() => scheduleAcceptance("exactDate")}
                />
                <ActionButton
                  disabled={busy}
                  label="Daily +2 min"
                  onPress={() => scheduleAcceptance("daily")}
                />
                <ActionButton
                  disabled={busy}
                  label="Weekly +2 min"
                  onPress={() => scheduleAcceptance("weekly")}
                />
                <ActionButton
                  disabled={busy}
                  label="Replacement A"
                  onPress={() => scheduleAcceptance("replacementA")}
                />
                <ActionButton
                  disabled={busy}
                  label="Replacement B"
                  onPress={() => scheduleAcceptance("replacementB")}
                />
                <ActionButton
                  disabled={busy}
                  label="Cancel all tests"
                  onPress={() => void run(cancelNotificationAcceptance)}
                />
                <ActionButton
                  disabled={busy}
                  label="Remove acceptance tool"
                  onPress={() => void run(removeNotificationAcceptanceFixture)}
                />
              </>
            )}
          </View>
        </View>
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
  return status.permission === "granted" ? "Granted" : "Not allowed";
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
  acceptanceCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.card,
    borderWidth: 1,
    gap: spacing.item,
    padding: spacing.card,
  },
  acceptanceTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "800",
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
  entryList: {
    gap: 5,
  },
  entryText: {
    color: colors.textMuted,
    fontFamily: "monospace",
    fontSize: 12,
    lineHeight: 18,
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
