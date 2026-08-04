import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import type { MiniAppInspection, SerializableValue } from "../model";
import { useMiniApp } from "../useMiniApp";
import { ErrorNotice } from "./ErrorNotice";
import { FeedbackNotice } from "./FeedbackNotice";
import { MiniAppRenderer } from "./MiniAppRenderer";
import { colors, spacing } from "./theme";

export interface MiniAppRuntimePanelProps {
  readonly source: string | null;
  readonly storageId: string | null;
  readonly initialScreen?: string;
  readonly initialScreenInput?: SerializableValue;
  readonly onReady?: (inspection: MiniAppInspection) => void;
  readonly onError?: (message: string) => void;
}

export function MiniAppRuntimePanel({
  source,
  storageId,
  initialScreen = "home",
  initialScreenInput,
  onReady,
  onError,
}: MiniAppRuntimePanelProps) {
  const {
    error,
    feedback,
    inspection,
    loading,
    page,
    snapshot,
    dismissFeedback,
    invokeAction,
    navigate,
    updateSetting,
  } = useMiniApp(source, storageId, initialScreen, initialScreenInput);

  useEffect(() => {
    if (error !== null) {
      onError?.(error);
      return;
    }
    if (!loading && inspection !== null && page !== null && snapshot !== null) {
      onReady?.(inspection);
    }
  }, [error, inspection, loading, onError, onReady, page, snapshot]);

  if (source === null) return null;

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Opening…</Text>
      </View>
    );
  }

  if (error !== null) {
    return (
      <ErrorNotice
        detail={error}
        message="Check the tool script in Manage, then try again."
        title="This tool couldn’t open"
      />
    );
  }

  if (page === null || snapshot === null || inspection === null) {
    return (
      <ErrorNotice
        detail="The tool completed without returning a screen."
        message="Check the tool script in Manage, then try again."
        title="This tool couldn’t open"
      />
    );
  }

  return (
    <View style={styles.runtime}>
      {feedback === null ? null : (
        <FeedbackNotice message={feedback} onDismiss={dismissFeedback} />
      )}
      <MiniAppRenderer
        page={page}
        settings={inspection.settings}
        settingValues={snapshot.settings}
        timers={snapshot.timers}
        onAction={invokeAction}
        onNavigate={navigate}
        onSettingChange={updateSetting}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    alignItems: "center",
    gap: 12,
    justifyContent: "center",
    minHeight: 240,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 15,
  },
  runtime: {
    gap: spacing.item,
  },
});
