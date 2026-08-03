import { StatusBar } from "expo-status-bar";
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { MiniAppRenderer } from "./src/ui/MiniAppRenderer";
import { SettingsPanel } from "./src/ui/SettingsPanel";
import { useBathroomPay } from "./src/useBathroomPay";

export default function App() {
  const {
    error,
    inspection,
    loading,
    page,
    snapshot,
    invokeAction,
    updateSetting,
  } = useBathroomPay();

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>
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
});
