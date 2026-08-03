import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { BUNDLED_MINI_APPS } from "./src/generated/bundled-mini-apps";
import { MiniAppRenderer } from "./src/ui/MiniAppRenderer";
import { SettingsPanel } from "./src/ui/SettingsPanel";
import { useMiniApp } from "./src/useMiniApp";

export default function App() {
  const [selectedFileName, setSelectedFileName] = useState<string | null>(
    BUNDLED_MINI_APPS[0]?.fileName ?? null,
  );
  const selectedMiniApp = useMemo(
    () =>
      BUNDLED_MINI_APPS.find(
        (miniApp) => miniApp.fileName === selectedFileName,
      ) ?? null,
    [selectedFileName],
  );
  const {
    error,
    inspection,
    loading,
    page,
    snapshot,
    invokeAction,
    updateSetting,
  } = useMiniApp(selectedMiniApp?.source ?? null);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>
        {BUNDLED_MINI_APPS.length > 1 ? (
          <View style={styles.library}>
            <Text style={styles.libraryTitle}>Mini apps</Text>
            <View style={styles.libraryRow}>
              {BUNDLED_MINI_APPS.map((miniApp) => {
                const selected = miniApp.fileName === selectedFileName;
                return (
                  <Pressable
                    accessibilityRole="button"
                    key={miniApp.fileName}
                    onPress={() => setSelectedFileName(miniApp.fileName)}
                    style={[
                      styles.libraryButton,
                      selected ? styles.libraryButtonSelected : null,
                    ]}
                  >
                    <Text
                      style={[
                        styles.libraryButtonText,
                        selected ? styles.libraryButtonTextSelected : null,
                      ]}
                    >
                      {miniApp.fileName.replace(/\.miniapp\.js$/, "")}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {selectedMiniApp === null ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No mini apps are available</Text>
            <Text style={styles.emptyText}>
              Add a script to the generated mini-app catalog.
            </Text>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" />
            <Text style={styles.loadingText}>Starting the mini-app runtime…</Text>
          </View>
        ) : null}

        {error === null ? null : (
          <View accessibilityRole="alert" style={styles.errorCard}>
            <Text style={styles.errorTitle}>Pocket Tools could not continue</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {inspection !== null && snapshot !== null ? (
          <SettingsPanel
            definitions={inspection.settings}
            values={snapshot.settings}
            onChange={updateSetting}
          />
        ) : null}

        {page !== null && snapshot !== null ? (
          <MiniAppRenderer
            page={page}
            timers={snapshot.timers}
            onAction={invokeAction}
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: "#eef1f5",
    flex: 1,
  },
  content: {
    gap: 16,
    padding: 18,
    paddingBottom: 40,
  },
  library: {
    gap: 8,
  },
  libraryTitle: {
    color: "#344054",
    fontSize: 14,
    fontWeight: "700",
  },
  libraryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  libraryButton: {
    backgroundColor: "#ffffff",
    borderColor: "#d0d5dd",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  libraryButtonSelected: {
    backgroundColor: "#172033",
    borderColor: "#172033",
  },
  libraryButtonText: {
    color: "#344054",
    fontSize: 14,
    fontWeight: "600",
  },
  libraryButtonTextSelected: {
    color: "#ffffff",
  },
  centered: {
    alignItems: "center",
    gap: 12,
    justifyContent: "center",
    minHeight: 300,
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
    gap: 5,
    padding: 16,
  },
  errorTitle: {
    color: "#912018",
    fontSize: 16,
    fontWeight: "700",
  },
  errorText: {
    color: "#b42318",
    fontSize: 14,
  },
  emptyCard: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 18,
    gap: 5,
    padding: 24,
  },
  emptyTitle: {
    color: "#344054",
    fontSize: 17,
    fontWeight: "700",
  },
  emptyText: {
    color: "#667085",
    fontSize: 14,
    textAlign: "center",
  },
});
