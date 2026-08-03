import { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import type { MiniAppInspection } from "../model";
import { formatMiniAppError, inspectMiniApp } from "../runtime/quickjs";
import {
  parseMiniAppBackup,
  validateMiniAppBackupForRestore,
  type MiniAppBackupV1,
} from "../storage/backup";
import {
  getMiniAppRestoreConflict,
  restoreMiniAppBackup,
} from "../storage/backup-storage";
import type { InstalledMiniApp } from "../storage/database";

export interface MiniAppBackupEditorProps {
  readonly onCancel: () => void;
  readonly onRestored: (app: InstalledMiniApp) => void;
}

interface RestoreCandidate {
  readonly backup: MiniAppBackupV1;
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
        `Valid backup: ${backup.app.name} (${backup.app.id}) with ${backup.settings.length} settings, ${backup.records.length} records, and ${backup.timers.length} active timers.`,
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
      setError("BACKUP_INVALID: Validate the current backup before restoring it.");
      return;
    }

    try {
      const conflict = await getMiniAppRestoreConflict(candidate.backup.app.id);
      if (conflict === null) {
        await performRestore(candidate, false);
        return;
      }

      const title =
        conflict.kind === "installed"
          ? `Replace ${conflict.app.name}?`
          : `Replace retained data for ${conflict.appId}?`;
      const detail =
        conflict.kind === "installed"
          ? "the installed source and all isolated app state"
          : "the retained settings, records, and active timers";

      Alert.alert(
        title,
        `Restoring this backup will atomically replace ${detail} for the same manifest ID.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Replace from backup",
            style: "destructive",
            onPress: () => void performRestore(candidate, true),
          },
        ],
      );
    } catch (caught) {
      setError(formatBackupError(caught));
    }
  }, [candidate, performRestore]);

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.toolbar}>
        <Pressable accessibilityRole="button" onPress={onCancel} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Cancel</Text>
        </Pressable>
        <Text style={styles.title}>Restore mini-app backup</Text>
      </View>

      <View style={styles.notice}>
        <Text style={styles.noticeTitle}>Portable local backup</Text>
        <Text style={styles.noticeText}>
          Paste one Pocket Tools version 1 backup. Validation checks both saved sources and every
          stored setting and record before SQLite changes begin.
        </Text>
      </View>

      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        multiline
        onChangeText={invalidateSource}
        placeholder="Paste one .pocket-tools-backup.json document"
        style={styles.editor}
        textAlignVertical="top"
        value={source}
      />

      <View style={styles.buttonRow}>
        <ActionButton
          disabled={busy || source.length === 0}
          label="Validate backup"
          onPress={validate}
        />
        <ActionButton
          disabled={busy || candidate === null}
          label={busy ? "Working…" : "Restore backup"}
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
        <View accessibilityRole="alert" style={styles.errorCard}>
          <Text style={styles.errorTitle}>The backup cannot be restored</Text>
          <Text selectable style={styles.errorText}>
            {error}
          </Text>
        </View>
      )}
    </ScrollView>
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
      style={[
        styles.actionButton,
        primary ? styles.actionButtonPrimary : null,
        disabled ? styles.actionButtonDisabled : null,
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
    padding: 18,
    paddingBottom: 48,
  },
  toolbar: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
  },
  title: {
    color: "#101828",
    flex: 1,
    fontSize: 22,
    fontWeight: "800",
  },
  secondaryButton: {
    backgroundColor: "#ffffff",
    borderColor: "#d0d5dd",
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  secondaryButtonText: {
    color: "#344054",
    fontSize: 14,
    fontWeight: "700",
  },
  notice: {
    backgroundColor: "#eff8ff",
    borderColor: "#b2ddff",
    borderRadius: 14,
    borderWidth: 1,
    gap: 5,
    padding: 14,
  },
  noticeTitle: {
    color: "#175cd3",
    fontSize: 14,
    fontWeight: "800",
  },
  noticeText: {
    color: "#1849a9",
    fontSize: 13,
    lineHeight: 19,
  },
  editor: {
    backgroundColor: "#101828",
    borderColor: "#344054",
    borderRadius: 14,
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
    backgroundColor: "#ffffff",
    borderColor: "#d0d5dd",
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  actionButtonPrimary: {
    backgroundColor: "#172033",
    borderColor: "#172033",
  },
  actionButtonDisabled: {
    opacity: 0.45,
  },
  actionButtonText: {
    color: "#344054",
    fontSize: 14,
    fontWeight: "700",
  },
  actionButtonPrimaryText: {
    color: "#ffffff",
  },
  successCard: {
    backgroundColor: "#ecfdf3",
    borderColor: "#abefc6",
    borderRadius: 12,
    borderWidth: 1,
    padding: 13,
  },
  successText: {
    color: "#067647",
    fontSize: 13,
    lineHeight: 19,
  },
  errorCard: {
    backgroundColor: "#fff1f0",
    borderColor: "#fda29b",
    borderRadius: 14,
    borderWidth: 1,
    gap: 5,
    padding: 14,
  },
  errorTitle: {
    color: "#912018",
    fontSize: 15,
    fontWeight: "800",
  },
  errorText: {
    color: "#b42318",
    fontFamily: "monospace",
    fontSize: 13,
    lineHeight: 18,
  },
});
