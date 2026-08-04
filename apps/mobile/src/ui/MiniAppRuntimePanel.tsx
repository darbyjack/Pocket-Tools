import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import type { MiniAppInspection } from "../model";
import { useMiniApp } from "../useMiniApp";
import { ErrorNotice } from "./ErrorNotice";
import { MiniAppRenderer } from "./MiniAppRenderer";
import { colors } from "./theme";

export interface MiniAppRuntimePanelProps {
  readonly source: string | null;
  readonly storageId: string | null;
  readonly onReady?: (inspection: MiniAppInspection) => void;
  readonly onError?: (message: string) => void;
}

export function MiniAppRuntimePanel({
  source,
  storageId,
  onReady,
  onError,
}: MiniAppRuntimePanelProps) {
  const { error, inspection, loading, page, snapshot, invokeAction, navigate, updateSetting } =
    useMiniApp(source, storageId);

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
    <MiniAppRenderer
      page={page}
      settings={inspection.settings}
      settingValues={snapshot.settings}
      timers={snapshot.timers}
      onAction={invokeAction}
      onNavigate={navigate}
      onSettingChange={updateSetting}
    />
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
});
