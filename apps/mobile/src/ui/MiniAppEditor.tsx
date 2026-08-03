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
import { MiniAppRuntimePanel } from "./MiniAppRuntimePanel";
import { ScreenScrollView } from "./ScreenScrollView";

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
      setMessage(
        `Valid SDK v1 definition: ${inspection.manifest.name} (${inspection.manifest.id}).`,
      );
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
      setMessage(
        `Preview is using a disposable copy of retained state for ${inspection.manifest.id}.`,
      );
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
      setError(
        "INSTALLATION_FAILED: Preview the current source successfully before installing it.",
      );
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

  const saveLabel = mode === "edit" ? "Update installed app" : "Install app";
  const title =
    mode === "edit"
      ? `Edit ${installed?.name ?? "mini app"}`
      : mode === "duplicate"
        ? `Duplicate ${installed?.name ?? "mini app"}`
        : "Install a mini-app script";
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

      <View style={styles.disclosure}>
        <Text style={styles.disclosureTitle}>Offline SDK authority</Text>
        <Text style={styles.disclosureText}>
          This script can use only isolated local settings, records, and durable timers. It cannot
          access the network, files, location, notifications, secrets, React Native, or Android
          APIs.
        </Text>
      </View>

      {mode === "duplicate" ? (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>
            Change manifest.id before previewing. A duplicate cannot reuse the original app’s
            permanent storage identity.
          </Text>
        </View>
      ) : null}

      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        multiline
        onChangeText={invalidateSource}
        placeholder="Paste one Pocket Tools SDK v1 JavaScript module"
        style={styles.editor}
        textAlignVertical="top"
        value={source}
      />

      <View style={styles.buttonRow}>
        <EditorButton
          disabled={busy}
          label={busy ? "Working…" : "Validate"}
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
        <View accessibilityRole="alert" style={styles.errorCard}>
          <Text style={styles.errorTitle}>The script cannot be installed</Text>
          <Text selectable style={styles.errorText}>
            {error}
          </Text>
        </View>
      )}

      {preview === null ? null : (
        <View style={styles.previewCard}>
          <View style={styles.previewHeading}>
            <Text style={styles.previewTitle}>Isolated preview</Text>
            <Text style={styles.previewStatus}>
              {previewReadySource === preview.source
                ? "First render passed"
                : previewError === null
                  ? "Rendering…"
                  : "Preview failed"}
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
      style={[
        styles.editorButton,
        primary ? styles.editorButtonPrimary : null,
        disabled ? styles.editorButtonDisabled : null,
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
  disclosure: {
    backgroundColor: "#eff8ff",
    borderColor: "#b2ddff",
    borderRadius: 14,
    borderWidth: 1,
    gap: 5,
    padding: 14,
  },
  disclosureTitle: {
    color: "#175cd3",
    fontSize: 14,
    fontWeight: "800",
  },
  disclosureText: {
    color: "#1849a9",
    fontSize: 13,
    lineHeight: 19,
  },
  notice: {
    backgroundColor: "#fffaeb",
    borderColor: "#fedf89",
    borderRadius: 12,
    borderWidth: 1,
    padding: 13,
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
    backgroundColor: "#ffffff",
    borderColor: "#d0d5dd",
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  editorButtonPrimary: {
    backgroundColor: "#172033",
    borderColor: "#172033",
  },
  editorButtonDisabled: {
    opacity: 0.45,
  },
  editorButtonText: {
    color: "#344054",
    fontSize: 14,
    fontWeight: "700",
  },
  editorButtonPrimaryText: {
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
  previewCard: {
    backgroundColor: "#ffffff",
    borderColor: "#d0d5dd",
    borderRadius: 18,
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
    color: "#101828",
    fontSize: 17,
    fontWeight: "800",
  },
  previewStatus: {
    color: "#475467",
    fontSize: 12,
    fontWeight: "700",
  },
});
