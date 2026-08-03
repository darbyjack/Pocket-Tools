import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { DIAGNOSTIC_APP_ID_PREFIX } from "./src/diagnostics/fixtures";
import { cleanupAbandonedLifecycleDiagnostics } from "./src/diagnostics/startup";
import bundledMiniApps from "./src/generated/bundled-mini-apps.json";
import { inspectMiniApp } from "./src/runtime/quickjs";
import {
  deleteInstalledMiniApp,
  initializeDatabase,
  listInstalledMiniApps,
  rollbackInstalledMiniApp,
  seedBundledMiniAppsOnce,
  type InstalledMiniApp,
} from "./src/storage/database";
import { InstalledMiniAppRunner } from "./src/ui/InstalledMiniAppRunner";
import { LifecycleDiagnostics } from "./src/ui/LifecycleDiagnostics";
import { MiniAppEditor, type MiniAppEditorMode } from "./src/ui/MiniAppEditor";
import { MiniAppLibrary } from "./src/ui/MiniAppLibrary";

type Route =
  | { readonly name: "library" }
  | { readonly name: "diagnostics" }
  | { readonly name: "run"; readonly appId: string }
  | {
      readonly name: "editor";
      readonly mode: MiniAppEditorMode;
      readonly appId: string | null;
    };

export default function App() {
  const [apps, setApps] = useState<readonly InstalledMiniApp[]>([]);
  const [route, setRoute] = useState<Route>({ name: "library" });
  const [loading, setLoading] = useState(true);
  const [startupError, setStartupError] = useState<string | null>(null);

  const refreshApps = useCallback(async () => {
    const installed = visibleInstalledApps(await listInstalledMiniApps());
    setApps(installed);
    return installed;
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await initializeDatabase();
        await cleanupAbandonedLifecycleDiagnostics();
        const seeds = await Promise.all(
          bundledMiniApps.map(async (entry) => ({
            inspection: await inspectMiniApp(entry.source),
            source: entry.source,
          })),
        );
        await seedBundledMiniAppsOnce(seeds);
        const installed = visibleInstalledApps(await listInstalledMiniApps());
        if (!cancelled) setApps(installed);
      } catch (caught) {
        if (!cancelled) {
          setStartupError(caught instanceof Error ? caught.message : String(caught));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const exportSource = useCallback(async (app: InstalledMiniApp) => {
    try {
      await Share.share({
        title: `${app.name}.miniapp.js`,
        message: app.activeSource,
      });
    } catch (caught) {
      Alert.alert("Export failed", caught instanceof Error ? caught.message : String(caught));
    }
  }, []);

  const removeApp = useCallback(
    (app: InstalledMiniApp) => {
      const remove = async (deleteData: boolean) => {
        try {
          await deleteInstalledMiniApp(app.id, deleteData);
          await refreshApps();
          setRoute({ name: "library" });
        } catch (caught) {
          Alert.alert("Remove failed", caught instanceof Error ? caught.message : String(caught));
        }
      };

      Alert.alert(
        `Remove ${app.name}?`,
        "You can keep its isolated settings, records, and timers for a later reinstall, or remove all of its data now.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Remove app",
            style: "destructive",
            onPress: () => void remove(false),
          },
          {
            text: "Remove app and data",
            style: "destructive",
            onPress: () => void remove(true),
          },
        ],
      );
    },
    [refreshApps],
  );

  const rollback = useCallback(
    (app: InstalledMiniApp) => {
      Alert.alert(
        `Roll back ${app.name}?`,
        "The current source and last-known-good source will be swapped. App data is not changed.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Roll back",
            onPress: () => {
              void (async () => {
                try {
                  const inspection = await inspectMiniApp(app.lastKnownGoodSource);
                  await rollbackInstalledMiniApp(app.id, inspection);
                  await refreshApps();
                  setRoute({ name: "run", appId: app.id });
                } catch (caught) {
                  Alert.alert(
                    "Rollback failed",
                    caught instanceof Error ? caught.message : String(caught),
                  );
                }
              })();
            },
          },
        ],
      );
    },
    [refreshApps],
  );

  const handleSaved = useCallback(
    async (saved: InstalledMiniApp) => {
      await refreshApps();
      setRoute({ name: "run", appId: saved.id });
    },
    [refreshApps],
  );

  const selectedApp =
    route.name === "run" || route.name === "editor"
      ? (apps.find((app) => app.id === route.appId) ?? null)
      : null;
  const routeRequiresMissingApp =
    route.name === "run" || (route.name === "editor" && route.mode !== "create");

  let content: ReactNode;
  if (loading) {
    content = (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading installed mini apps…</Text>
      </View>
    );
  } else if (startupError !== null) {
    content = (
      <View accessibilityRole="alert" style={styles.startupError}>
        <Text style={styles.startupErrorTitle}>Pocket Tools could not start</Text>
        <Text selectable style={styles.startupErrorText}>
          {startupError}
        </Text>
      </View>
    );
  } else if (route.name === "library") {
    content = (
      <MiniAppLibrary
        apps={apps}
        onCreate={() => setRoute({ name: "editor", mode: "create", appId: null })}
        onDelete={removeApp}
        onDiagnostics={() => setRoute({ name: "diagnostics" })}
        onDuplicate={(app) => setRoute({ name: "editor", mode: "duplicate", appId: app.id })}
        onEdit={(app) => setRoute({ name: "editor", mode: "edit", appId: app.id })}
        onExport={(app) => void exportSource(app)}
        onOpen={(app) => setRoute({ name: "run", appId: app.id })}
      />
    );
  } else if (route.name === "diagnostics") {
    content = (
      <LifecycleDiagnostics
        onBack={() => {
          void refreshApps();
          setRoute({ name: "library" });
        }}
      />
    );
  } else if (routeRequiresMissingApp && selectedApp === null) {
    content = (
      <View style={styles.startupError}>
        <Text style={styles.startupErrorTitle}>Mini app not found</Text>
        <Text style={styles.startupErrorText}>
          The installation was removed or is no longer available.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => setRoute({ name: "library" })}
          style={styles.returnButton}
        >
          <Text style={styles.returnButtonText}>Return to library</Text>
        </Pressable>
      </View>
    );
  } else if (route.name === "editor") {
    content = (
      <MiniAppEditor
        installed={selectedApp}
        key={`${route.mode}:${route.appId ?? "new"}`}
        mode={route.mode}
        onCancel={() => setRoute({ name: "library" })}
        onSaved={(saved) => void handleSaved(saved)}
      />
    );
  } else if (selectedApp !== null) {
    content = (
      <InstalledMiniAppRunner
        app={selectedApp}
        onBack={() => setRoute({ name: "library" })}
        onDuplicate={() =>
          setRoute({
            name: "editor",
            mode: "duplicate",
            appId: selectedApp.id,
          })
        }
        onEdit={() =>
          setRoute({
            name: "editor",
            mode: "edit",
            appId: selectedApp.id,
          })
        }
        onExport={() => void exportSource(selectedApp)}
        onRollback={() => rollback(selectedApp)}
      />
    );
  } else {
    content = null;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      {content}
    </SafeAreaView>
  );
}

function visibleInstalledApps(installed: readonly InstalledMiniApp[]): readonly InstalledMiniApp[] {
  return installed.filter((app) => !app.id.startsWith(DIAGNOSTIC_APP_ID_PREFIX));
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: "#eef1f5",
    flex: 1,
  },
  centered: {
    alignItems: "center",
    flex: 1,
    gap: 12,
    justifyContent: "center",
    padding: 24,
  },
  loadingText: {
    color: "#475467",
    fontSize: 15,
  },
  startupError: {
    backgroundColor: "#fff1f0",
    borderColor: "#fda29b",
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
    margin: 18,
    padding: 16,
  },
  startupErrorTitle: {
    color: "#912018",
    fontSize: 17,
    fontWeight: "800",
  },
  startupErrorText: {
    color: "#b42318",
    fontFamily: "monospace",
    fontSize: 13,
  },
  returnButton: {
    alignSelf: "flex-start",
    backgroundColor: "#912018",
    borderRadius: 10,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  returnButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
});
