import { useCallback, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import type { MiniAppInspection } from "../model";
import { formatMiniAppError, inspectMiniApp } from "../runtime/quickjs";
import {
  parseMiniAppBackup,
  validateMiniAppBackupForRestore,
  type MiniAppBackupV2,
} from "../storage/backup";
import { getMiniAppRestoreConflict, restoreMiniAppBackup } from "../storage/backup-storage";
import type { InstalledMiniApp } from "../storage/database";
import { ErrorNotice } from "./ErrorNotice";
import { ScreenScrollView } from "./ScreenScrollView";
import { colors, radii, spacing } from "./theme";

export interface MiniAppBackupEditorProps {
  readonly onCancel: () => void;
  readonly onRestored: (app: InstalledMiniApp) => void;
}

interface RestoreCandidate {
  readonly backup: MiniAppBackupV2;
  readonly activeInspection: MiniAppInspection;
  readonly lastKnownGoodInspection: MiniAppInspection;
}

export function MiniAppBackupEditor({ onCancel, onRestored }: MiniAppBackupEditorProps) {
  const [source, setSource] = useState("");
  const [candidate, setCandidate] = useState<RestoreCandidate | null>(null);
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
      const backup = parseMiniAppBackup(source);
      const [activeInspection, lastKnownGoodInspection] = await Promise.all([
        inspectMiniApp(backup.app.activeSource),
        inspectMiniApp(backup.app.lastKnownGoodSource),
      ]);
      validateMiniAppBackupForRestore(backup, activeInspection, lastKnownGoodInspection);
      setCandidate({ backup, activeInspection, lastKnownGoodInspection });
      setMessage(
        `Backup ready: ${backup.app.name}, ${backup.records.length} records, ${backup.timers.length} active timers, ${backup.notifications.length} reminders.`,
      );
    } catch (caught) {
      setError(formatBackupError(caught));
    } finally {
      setBusy(false);
    }
  }, [source]);

  const performRestore = useCallback(
    async (current: RestoreCandidate, replaceExisting: boolean) => {
      setBusy(true);
      setError(null);
      try {
        const restored = await restoreMiniAppBackup(
          current.backup,
          current.activeInspection,
          current.lastKnownGoodInspection,
          { replaceExisting },
        );
        onRestored(restored);
      } catch (caught) {
        setError(formatBackupError(caught));
      } finally {
        setBusy(false);
      }
    },
    [onRestored],
  );

  const restore = useCallback(async () => {
    if (candidate === null) {
      setError("BACKUP_INVALID: Check the current backup before restoring it.");
      return;
    }

    try {
      const conflict = await getMiniAppRestoreConflict(candidate.backup.app.id);
      if (conflict === null) {
        await performRestore(candidate, false);
        return;
      }

      const title = conflict.kind === "installed" ? `Replace ${conflict.app.name}?` : "Replace saved data?";

      Alert.alert(title, "This replaces the current tool and its saved data with the backup.", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Replace",
          style: "destructive",
          onPress: () => void performRestore(candidate, true),
        },
      ]);
    } catch (caught) {
      setError(formatBackupError(caught));
    }
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
        <Text style={styles.title}>Restore tool</Text>
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
          label={busy ? "Working…" : "Restore tool"}
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

function formatBackupError(caught: unknown): string {
  if (caught instanceof Error && caught.message.startsWith("BACKUP_")) return caught.message;
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
    backgroundColor: colors.brand,
    borderColor: colors.brand,
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
