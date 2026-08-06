import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import App from "../../App";
import { getDatabase } from "../storage/database-connection";
import { colors, radii } from "./theme";

type BootstrapState =
  | { readonly status: "loading" }
  | { readonly status: "ready" }
  | { readonly status: "error"; readonly message: string };

export function DatabaseBootstrap() {
  const [state, setState] = useState<BootstrapState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    void getDatabase()
      .then(() => {
        if (!cancelled) setState({ status: "ready" });
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        setState({
          status: "error",
          message: caught instanceof Error ? caught.message : String(caught),
        });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === "ready") return <App />;

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        {state.status === "loading" ? (
          <>
            <ActivityIndicator />
            <Text style={styles.title}>Preparing Pocket Tools</Text>
            <Text style={styles.message}>Checking your local data before startup.</Text>
          </>
        ) : (
          <>
            <Text style={styles.title}>Pocket Tools could not start</Text>
            <Text style={styles.message}>{state.message}</Text>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: colors.background,
  },
  card: {
    width: "100%",
    maxWidth: 520,
    gap: 12,
    padding: 20,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMuted,
  },
});
