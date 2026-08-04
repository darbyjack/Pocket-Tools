import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { assertFirstRenderAgainstRetainedState } from "../installer/first-render";
import { NEW_MINI_APP_TEMPLATE } from "../installer/template";
import {
  assertCandidateIdentity,
  createPreviewStorageId,
  isCurrentSourceApproved,
} from "../installer/workflow";
import type { MiniAppInspection } from "../model";
import { formatMiniAppError, inspectMiniApp } from "../runtime/quickjs";
import {
  clearAppData,
  installMiniApp,
  preparePreviewStorage,
  updateInstalledMiniApp,
  type InstalledMiniApp,
} from "../storage/database";
import { ErrorNotice } from "./ErrorNotice";
import { MiniAppRuntimePanel } from "./MiniAppRuntimePanel";
import { ScreenScrollView } from "./ScreenScrollView";
import { colors, radii, spacing } from "./theme";

export type MiniAppEditorMode = "create" | "duplicate" | "edit";

export interface MiniAppEditorProps {
  readonly installed: InstalledMiniApp | null;
  readonly mode: MiniAppEditorMode;
  readonly onCancel: () => void;
  readonly onSaved: (app: InstalledMiniApp) => void;
}

interface CandidateInspection {
  readonly inspection: MiniAppInspection;
  readonly source: string;
}

interface PreviewSession extends CandidateInspection {
  readonly storageId: string;
}

export function MiniAppEditor({ installed, mode, onCancel, onSaved }: MiniAppEditorProps) {
  const [source, setSource] = useState(installed?.activeSource ?? NEW_MINI_APP_TEMPLATE);
  const [candidate, setCandidate] = useState<CandidateInspection | null>(null);
  const [preview, setPreview] = useState<PreviewSession | null>(null);
  const [previewReadySource, setPreviewReadySource] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(
    () => () => {
      if (preview !== null) void clearAppData(preview.storageId);
    },
    [preview],
  );

  const validateCandidate = useCallback(
    async (currentSource: string): Promise<MiniAppInspection> => {
      const inspection = await inspectMiniApp(currentSource);
      assertCandidateIdentity(mode, installed?.id ?? null, inspection.manifest.id);
      return inspection;
    },
    [installed, mode],
  );

  const invalidateSource = useCallback(
    (nextSource: string) => {
      const previousPreview = preview;
      setSource(nextSource);
      setCandidate(null);
      setPreview(null);
      setPreviewReadySource(null);
      setPreviewError(null);
      setMessage(null);
      setError(null);
      if (previousPreview !== null) {
        void clearAppData(previousPreview.storageId);
      }
    },
    [preview],
  );

  const handleValidate = useCallback(async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const inspection = await validateCandidate(source);
      setCandidate({ inspection, source });
      setMessage("Script checked. Preview it before saving.");
    } catch (caught) {
      setCandidate(null);
      setError(formatMiniAppError(caught));
    } finally {
      setBusy(false);
    }
  }, [source, validateCandidate]);

  const handlePreview = useCallback(async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    setPreviewError(null);
    setPreviewReadySource(null);

    const previousPreview = preview;
    try {
      const inspection = await validateCandidate(source);
      const storageId = createPreviewStorageId();
      await preparePreviewStorage(inspection.manifest.id, storageId);
      if (previousPreview !== null) {
        await clearAppData(previousPreview.storageId);
      }
      const nextPreview = { inspection, source, storageId };
      setCandidate({ inspection, source });
      setPreview(nextPreview);
      setMessage("Preview opened below.");
    } catch (caught) {
      setPreview(null);
      setCandidate(null);
      setError(formatMiniAppError(caught));
    } finally {
      setBusy(false);
    }
  }, [preview, source, validateCandidate]);

  const handlePreviewReady = useCallback(
    (inspection: MiniAppInspection) => {
      if (preview !== null && inspection.manifest.id === preview.inspection.manifest.id) {
        setPreviewError(null);
        setPreviewReadySource(preview.source);
      }
    },
    [preview],
  );

  const handlePreviewError = useCallback((runtimeError: string) => {
    setPreviewReadySource(null);
    setPreviewError(runtimeError);
  }, []);

  const handleSave = useCallback(async () => {
    if (
      !isCurrentSourceApproved(source, candidate?.source ?? null, previewReadySource) ||
      candidate === null
    ) {
      setError("INSTALLATION_FAILED: Preview the current script successfully before saving it.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await assertFirstRenderAgainstRetainedState(source, candidate.inspection);
      const saved =
        mode === "edit" && installed !== null
          ? await updateInstalledMiniApp(installed.id, candidate.inspection, source)
          : await installMiniApp(candidate.inspection, source);
      if (preview !== null) await clearAppData(preview.storageId);
      onSaved(saved);
    } catch (caught) {
      setError(formatMiniAppError(caught));
    } finally {
      setBusy(false);
    }
  }, [candidate, installed, mode, onSaved, preview, previewReadySource, source]);

  const saveLabel = mode === "edit" ? "Update tool" : "Install tool";
  const title =
    mode === "edit"
      ? `Edit ${installed?.name ?? "tool"}`
      : mode === "duplicate"
        ? `Duplicate ${installed?.name ?? "tool"}`
        : "Add tool";
  const canSave =
    !busy && isCurrentSourceApproved(source, candidate?.source ?? null, previewReadySource);

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
        <Text style={styles.title}>{title}</Text>
      </View>

      {mode === "duplicate" ? (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>Change the tool ID before previewing.</Text>
        </View>
      ) : null}

      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        multiline
        onChangeText={invalidateSource}
        placeholder="Paste a Pocket Tools script"
        placeholderTextColor="#98a2b3"
        style={styles.editor}
        textAlignVertical="top"
        value={source}
      />

      <View style={styles.buttonRow}>
        <EditorButton
          disabled={busy}
          label={busy ? "Working…" : "Check"}
          onPress={handleValidate}
        />
        <EditorButton disabled={busy} label="Preview" onPress={handlePreview} />
        <EditorButton disabled={!canSave} label={saveLabel} onPress={handleSave} primary />
      </View>

      {message === null ? null : (
        <View style={styles.successCard}>
          <Text style={styles.successText}>{message}</Text>
        </View>
      )}

      {error === null ? null : (
        <ErrorNotice
          detail={error}
          message="Check the script and try again."
          title="This script isn’t ready"
        />
      )}

      {preview === null ? null : (
        <View style={styles.previewCard}>
          <View style={styles.previewHeading}>
            <Text style={styles.previewTitle}>Preview</Text>
            <Text style={styles.previewStatus}>
              {previewReadySource === preview.source
                ? "Ready"
                : previewError === null
                  ? "Opening…"
                  : "Needs attention"}
            </Text>
          </View>
          <MiniAppRuntimePanel
            onError={handlePreviewError}
            onReady={handlePreviewReady}
            source={preview.source}
            storageId={preview.storageId}
          />
        </View>
      )}
    </ScreenScrollView>
  );
}

function EditorButton({
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
        styles.editorButton,
        primary ? styles.editorButtonPrimary : null,
        disabled ? styles.editorButtonDisabled : null,
        pressed && !disabled ? styles.pressed : null,
      ]}
    >
      <Text style={[styles.editorButtonText, primary ? styles.editorButtonPrimaryText : null]}>
        {label}
      </Text>
    </Pressable>
  );
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
  notice: {
    backgroundColor: "#fffaeb",
    borderColor: "#fedf89",
    borderRadius: radii.button,
    borderWidth: 1,
    padding: 13,
  },
  noticeText: {
    color: "#93370d",
    fontSize: 13,
  },
  editor: {
    backgroundColor: colors.text,
    borderColor: "#344054",
    borderRadius: radii.card,
    borderWidth: 1,
    color: "#f2f4f7",
    fontFamily: "monospace",
    fontSize: 13,
    lineHeight: 19,
    minHeight: 420,
    padding: 14,
  },
  buttonRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9,
  },
  editorButton: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.button,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  editorButtonPrimary: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  editorButtonDisabled: {
    opacity: 0.45,
  },
  editorButtonText: {
    color: colors.brand,
    fontSize: 14,
    fontWeight: "700",
  },
  editorButtonPrimaryText: {
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
  previewCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.card,
    borderWidth: 1,
    gap: 14,
    padding: 14,
  },
  previewHeading: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
  },
  previewTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "800",
  },
  previewStatus: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },
});
