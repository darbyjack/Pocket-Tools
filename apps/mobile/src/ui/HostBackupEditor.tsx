import { useCallback, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { formatMiniAppError } from "../runtime/quickjs.ts";
import {
  prepareHostBackup,
  restoreHostBackup,
  type PreparedHostBackup,
} from "../storage/host-backup-storage.ts";
import type { InstalledMiniApp } from "../storage/database.ts";
import { ScreenScrollView } from "./ScreenScrollView.tsx";

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
          settings: totals.settings + app.settings.length,
          records: totals.records + app.records.length,
          timers: totals.timers + app.timers.length,
        }),
        { settings: 0, records: 0, timers: 0 },
      );
      const retainedState = prepared.backup.retained.reduce(
        (totals, state) => ({
          settings: totals.settings + state.settings.length,
          records: totals.records + state.records.length,
          timers: totals.timers + state.timers.length,
        }),
        { settings: 0, records: 0, timers: 0 },
      );
      setMessage(
        `Valid host backup: ${prepared.backup.apps.length} installed apps, ${prepared.backup.retained.length} retained namespaces, ${installedState.settings + retainedState.settings} settings, ${installedState.records + retainedState.records} records, and ${installedState.timers + retainedState.timers} active timers.`,
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
      setError("HOST_BACKUP_INVALID: Validate the current backup before restoring it.");
      return;
    }
    Alert.alert(
      "Replace all Pocket Tools data?",
      "This will atomically replace every installed mini app and every retained settings, records, and timer namespace. Internal host metadata is preserved.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Replace all data",
          style: "destructive",
          onPress: () => void performRestore(),
        },
      ],
    );
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
        <Text style={styles.title}>Restore complete backup</Text>
      </View>

      <View style={styles.notice}>
        <Text style={styles.noticeTitle}>Complete local recovery</Text>
        <Text style={styles.noticeText}>
          Paste one Pocket Tools host backup. Every installed source is inspected before the current
          mini-app library and retained user data can be replaced in one SQLite transaction.
        </Text>
      </View>

      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        multiline
        onChangeText={invalidateSource}
        placeholder="Paste one .pocket-tools-host-backup.json document"
        style={styles.editor}
        textAlignVertical="top"
        value={source}
      />

      <View style={styles.buttonRow}>
        <ActionButton
          disabled={busy || source.length === 0}
          label="Validate complete backup"
          onPress={validate}
        />
        <ActionButton
          disabled={busy || candidate === null}
          label={busy ? "Working…" : "Restore all data"}
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
          <Text style={styles.errorTitle}>The complete backup cannot be restored</Text>
          <Text selectable style={styles.errorText}>
            {error}
          </Text>
        </View>
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

function formatHostBackupError(caught: unknown): string {
  if (
    caught instanceof Error &&
    /^(?:HOST_BACKUP_|BACKUP_)/.test(caught.message)
  ) {
    return caught.message;
  }
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
    backgroundColor: "#fff6ed",
    borderColor: "#ffd6ae",
    borderRadius: 14,
    borderWidth: 1,
    gap: 5,
    padding: 14,
  },
  noticeTitle: {
    color: "#b93815",
    fontSize: 14,
    fontWeight: "800",
  },
  noticeText: {
    color: "#93370d",
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
    backgroundColor: "#912018",
    borderColor: "#912018",
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
