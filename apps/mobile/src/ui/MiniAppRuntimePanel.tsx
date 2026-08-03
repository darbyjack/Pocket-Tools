import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import type { MiniAppInspection } from "../model";
import { useMiniApp } from "../useMiniApp";
import { MiniAppRenderer } from "./MiniAppRenderer";

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
        <Text style={styles.loadingText}>Starting the mini-app runtime…</Text>
      </View>
    );
  }

  if (error !== null) {
    return (
      <View accessibilityRole="alert" style={styles.errorCard}>
        <Text style={styles.errorTitle}>Pocket Tools could not run this script</Text>
        <Text selectable style={styles.errorText}>
          {error}
        </Text>
      </View>
    );
  }

  if (page === null || snapshot === null || inspection === null) {
    return (
      <View style={styles.errorCard}>
        <Text style={styles.errorTitle}>The script returned no screen</Text>
      </View>
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
    color: "#475467",
    fontSize: 15,
  },
  errorCard: {
    backgroundColor: "#fff1f0",
    borderColor: "#fda29b",
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
    padding: 16,
  },
  errorTitle: {
    color: "#912018",
    fontSize: 16,
    fontWeight: "700",
  },
  errorText: {
    color: "#b42318",
    fontFamily: "monospace",
    fontSize: 13,
  },
});
