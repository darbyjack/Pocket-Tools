import { useCallback, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { formatMiniAppError } from "../runtime/quickjs.ts";
import {
  prepareHostBackup,
  restoreHostBackup,
  type PreparedHostBackup,
} from "../storage/host-backup-storage.ts";
import type { InstalledMiniApp } from "../storage/database.ts";
import { ErrorNotice } from "./ErrorNotice.tsx";
import { ScreenScrollView } from "./ScreenScrollView.tsx";
import { colors, radii, spacing } from "./theme.ts";

export interface HostBackupEditorProps {
  readonly onCancel: () => void;
  readonly onRestored: (apps: readonly InstalledMiniApp[]) => void;
}

export function HostBackupEditor({ onCancel, onRestored }: HostBackupEditorProps) {
  const [source, setSource] = useState("");
  const [candidate, setCandidate] = useState<PreparedHostBackup | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const invalidateSource = useCallback((nextSource: string) => {
    setSource(nextSource);
    setCandidate(null);
    setMessage(null);
    setError(null);
  }, []);

  const validate = useCallback(async () => {
    setBusy(true);
    setCandidate(null);
    setMessage(null);
    setError(null);
    try {
      const prepared = await prepareHostBackup(source);
      setCandidate(prepared);
      const installedState = prepared.backup.apps.reduce(
        (totals, app) => ({
          records: totals.records + app.records.length,
          timers: totals.timers + app.timers.length,
        }),
        { records: 0, timers: 0 },
      );
      const retainedState = prepared.backup.retained.reduce(
        (totals, state) => ({
          records: totals.records + state.records.length,
          timers: totals.timers + state.timers.length,
        }),
        { records: 0, timers: 0 },
      );
      setMessage(
        `Backup ready: ${prepared.backup.apps.length} tools, ${installedState.records + retainedState.records} records, ${installedState.timers + retainedState.timers} active timers.`,
      );
    } catch (caught) {
      setError(formatHostBackupError(caught));
    } finally {
      setBusy(false);
    }
  }, [source]);

  const performRestore = useCallback(async () => {
    if (candidate === null) return;
    setBusy(true);
    setError(null);
    try {
      const restored = await restoreHostBackup(candidate);
      onRestored(restored);
    } catch (caught) {
      setError(formatHostBackupError(caught));
    } finally {
      setBusy(false);
    }
  }, [candidate, onRestored]);

  const restore = useCallback(() => {
    if (candidate === null) {
      setError("HOST_BACKUP_INVALID: Check the current backup before restoring it.");
      return;
    }
    Alert.alert("Replace everything?", "This replaces all tools and saved data with the backup.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Replace everything",
        style: "destructive",
        onPress: () => void performRestore(),
      },
    ]);
  }, [candidate, performRestore]);

  return (
    <ScreenScrollView
      contentContainerStyle={styles.content}
      keyboardAware
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.toolbar}>
        <Pressable accessibilityRole="button" onPress={onCancel} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Cancel</Text>
        </Pressable>
        <Text style={styles.title}>Restore everything</Text>
      </View>

      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        multiline
        onChangeText={invalidateSource}
        placeholder="Paste a Pocket Tools backup"
        placeholderTextColor="#98a2b3"
        style={styles.editor}
        textAlignVertical="top"
        value={source}
      />

      <View style={styles.buttonRow}>
        <ActionButton
          disabled={busy || source.length === 0}
          label="Check backup"
          onPress={validate}
        />
        <ActionButton
          disabled={busy || candidate === null}
          label={busy ? "Working…" : "Restore everything"}
          onPress={restore}
          primary
        />
      </View>

      {message === null ? null : (
        <View style={styles.successCard}>
          <Text style={styles.successText}>{message}</Text>
        </View>
      )}

      {error === null ? null : (
        <ErrorNotice
          detail={error}
          message="Check the backup and try again."
          title="This backup can’t be restored"
        />
      )}
    </ScreenScrollView>
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
        primary ? styles.actionButtonPrimary : null,
        disabled ? styles.actionButtonDisabled : null,
        pressed && !disabled ? styles.pressed : null,
      ]}
    >
      <Text style={[styles.actionButtonText, primary ? styles.actionButtonPrimaryText : null]}>
        {label}
      </Text>
    </Pressable>
  );
}

function formatHostBackupError(caught: unknown): string {
  if (caught instanceof Error && /^(?:HOST_BACKUP_|BACKUP_)/.test(caught.message)) {
    return caught.message;
  }
  return formatMiniAppError(caught);
}

const styles = StyleSheet.create({
  content: {
    gap: 16,
    padding: spacing.screen,
    paddingBottom: 48,
  },
  toolbar: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
  },
  title: {
    color: colors.text,
    flex: 1,
    fontSize: 22,
    fontWeight: "800",
  },
  secondaryButton: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.button,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  secondaryButtonText: {
    color: colors.brand,
    fontSize: 14,
    fontWeight: "700",
  },
  editor: {
    backgroundColor: colors.text,
    borderColor: "#344054",
    borderRadius: radii.card,
    borderWidth: 1,
    color: "#f2f4f7",
    fontFamily: "monospace",
    fontSize: 12,
    lineHeight: 18,
    minHeight: 420,
    padding: 14,
  },
  buttonRow: {
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
  actionButtonPrimary: {
    backgroundColor: colors.danger,
    borderColor: colors.danger,
  },
  actionButtonDisabled: {
    opacity: 0.45,
  },
  actionButtonText: {
    color: colors.brand,
    fontSize: 14,
    fontWeight: "700",
  },
  actionButtonPrimaryText: {
    color: colors.surface,
  },
  pressed: {
    opacity: 0.72,
  },
  successCard: {
    backgroundColor: colors.successBackground,
    borderColor: colors.successBorder,
    borderRadius: radii.button,
    borderWidth: 1,
    padding: 13,
  },
  successText: {
    color: colors.success,
    fontSize: 13,
  },
});
