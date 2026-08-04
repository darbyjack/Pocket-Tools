import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, Alert, Pressable, Share, StyleSheet, Text, View } from "react-native";
import {
  initialWindowMetrics,
  SafeAreaProvider,
  SafeAreaView,
} from "react-native-safe-area-context";

import { DIAGNOSTIC_APP_ID_PREFIX } from "./src/diagnostics/fixtures";
import { cleanupAbandonedLifecycleDiagnostics } from "./src/diagnostics/startup";
import bundledMiniApps from "./src/generated/bundled-mini-apps.json";
import { inspectMiniApp } from "./src/runtime/quickjs";
import { stringifyMiniAppBackup } from "./src/storage/backup";
import { createMiniAppBackup } from "./src/storage/backup-storage";
import {
  initializeDatabase,
  listInstalledMiniApps,
  rollbackInstalledMiniApp,
  seedBundledMiniAppsOnce,
  type InstalledMiniApp,
} from "./src/storage/database";
import { stringifyHostBackup } from "./src/storage/host-backup";
import { createHostBackup } from "./src/storage/host-backup-storage";
import { deleteInstalledMiniAppWithNotifications } from "./src/storage/notification-removal";
import { ErrorNotice } from "./src/ui/ErrorNotice";
import { HostBackupEditor } from "./src/ui/HostBackupEditor";
import { HostSettings } from "./src/ui/HostSettings";
import { InstalledMiniAppRunner } from "./src/ui/InstalledMiniAppRunner";
import { LifecycleDiagnostics } from "./src/ui/LifecycleDiagnostics";
import { MiniAppBackupEditor } from "./src/ui/MiniAppBackupEditor";
import { MiniAppEditor, type MiniAppEditorMode } from "./src/ui/MiniAppEditor";
import { MiniAppLibrary } from "./src/ui/MiniAppLibrary";
import { MiniAppManagement } from "./src/ui/MiniAppManagement";
import { colors, radii } from "./src/ui/theme";

type Route =
  | { readonly name: "library" }
  | { readonly name: "settings" }
  | { readonly name: "backup" }
  | { readonly name: "hostBackup" }
  | { readonly name: "diagnostics" }
  | { readonly name: "run"; readonly appId: string }
  | { readonly name: "manage"; readonly appId: string }
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

  const exportBackup = useCallback(async (app: InstalledMiniApp) => {
    try {
      const backup = await createMiniAppBackup(app.id);
      await Share.share({
        title: `${app.name}.pocket-tools-backup.json`,
        message: stringifyMiniAppBackup(backup),
      });
    } catch (caught) {
      Alert.alert("Backup failed", caught instanceof Error ? caught.message : String(caught));
    }
  }, []);

  const exportAllBackup = useCallback(async () => {
    try {
      const backup = await createHostBackup();
      await Share.share({
        title: "Pocket Tools.pocket-tools-host-backup.json",
        message: stringifyHostBackup(backup),
      });
    } catch (caught) {
      Alert.alert("Backup failed", caught instanceof Error ? caught.message : String(caught));
    }
  }, []);

  const removeApp = useCallback(
    (app: InstalledMiniApp) => {
      const remove = async (deleteData: boolean) => {
        try {
          await deleteInstalledMiniAppWithNotifications(app.id, deleteData);
          await refreshApps();
          setRoute({ name: "library" });
        } catch (caught) {
          Alert.alert("Remove failed", caught instanceof Error ? caught.message : String(caught));
        }
      };

      Alert.alert(`Remove ${app.name}?`, "Keep its saved data for a later reinstall?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Keep data",
          style: "destructive",
          onPress: () => void remove(false),
        },
        {
          text: "Remove data too",
          style: "destructive",
          onPress: () => void remove(true),
        },
      ]);
    },
    [refreshApps],
  );

  const rollback = useCallback(
    (app: InstalledMiniApp) => {
      Alert.alert(`Roll back ${app.name}?`, "This restores the previous script version.", [
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
      ]);
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

  const handleHostRestored = useCallback(async () => {
    await refreshApps();
    setRoute({ name: "library" });
  }, [refreshApps]);

  const selectedApp =
    route.name === "run" || route.name === "manage" || route.name === "editor"
      ? (apps.find((app) => app.id === route.appId) ?? null)
      : null;
  const routeRequiresMissingApp =
    route.name === "run" ||
    route.name === "manage" ||
    (route.name === "editor" && route.mode !== "create");

  let content: ReactNode;
  if (loading) {
    content = (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Opening Pocket Tools…</Text>
      </View>
    );
  } else if (startupError !== null) {
    content = (
      <View style={styles.errorContainer}>
        <ErrorNotice
          detail={startupError}
          message="Close the app and try again."
          title="Pocket Tools couldn’t start"
        />
      </View>
    );
  } else if (route.name === "library") {
    content = (
      <MiniAppLibrary
        apps={apps}
        onCreate={() => setRoute({ name: "editor", mode: "create", appId: null })}
        onOpen={(app) => setRoute({ name: "run", appId: app.id })}
        onSettings={() => setRoute({ name: "settings" })}
      />
    );
  } else if (route.name === "settings") {
    content = (
      <HostSettings
        onBack={() => setRoute({ name: "library" })}
        onBackupAll={() => void exportAllBackup()}
        onDiagnostics={() => setRoute({ name: "diagnostics" })}
        onRestoreAll={() => setRoute({ name: "hostBackup" })}
        onRestoreOne={() => setRoute({ name: "backup" })}
      />
    );
  } else if (route.name === "backup") {
    content = (
      <MiniAppBackupEditor
        onCancel={() => setRoute({ name: "settings" })}
        onRestored={(restored) => void handleSaved(restored)}
      />
    );
  } else if (route.name === "hostBackup") {
    content = (
      <HostBackupEditor
        onCancel={() => setRoute({ name: "settings" })}
        onRestored={() => void handleHostRestored()}
      />
    );
  } else if (route.name === "diagnostics") {
    content = (
      <LifecycleDiagnostics
        onBack={() => {
          void refreshApps();
          setRoute({ name: "settings" });
        }}
      />
    );
  } else if (routeRequiresMissingApp && selectedApp === null) {
    content = (
      <View style={styles.missingCard}>
        <Text style={styles.missingTitle}>Tool not found</Text>
        <Text style={styles.missingText}>It may have been removed.</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => setRoute({ name: "library" })}
          style={styles.returnButton}
        >
          <Text style={styles.returnButtonText}>Back to Pocket Tools</Text>
        </Pressable>
      </View>
    );
  } else if (route.name === "editor") {
    content = (
      <MiniAppEditor
        installed={selectedApp}
        key={`${route.mode}:${route.appId ?? "new"}`}
        mode={route.mode}
        onCancel={() =>
          setRoute(
            route.mode === "create" || selectedApp === null
              ? { name: "library" }
              : { name: "manage", appId: selectedApp.id },
          )
        }
        onSaved={(saved) => void handleSaved(saved)}
      />
    );
  } else if (route.name === "manage" && selectedApp !== null) {
    content = (
      <MiniAppManagement
        app={selectedApp}
        onBack={() => setRoute({ name: "run", appId: selectedApp.id })}
        onBackup={() => void exportBackup(selectedApp)}
        onDelete={() => removeApp(selectedApp)}
        onDuplicate={() =>
          setRoute({ name: "editor", mode: "duplicate", appId: selectedApp.id })
        }
        onEdit={() => setRoute({ name: "editor", mode: "edit", appId: selectedApp.id })}
        onExport={() => void exportSource(selectedApp)}
        onRollback={() => rollback(selectedApp)}
      />
    );
  } else if (route.name === "run" && selectedApp !== null) {
    content = (
      <InstalledMiniAppRunner
        app={selectedApp}
        onBack={() => setRoute({ name: "library" })}
        onManage={() => setRoute({ name: "manage", appId: selectedApp.id })}
      />
    );
  } else {
    content = null;
  }

  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <StatusBar style="dark" />
      <SafeAreaView
        edges={["top", "right", "bottom", "left"]}
        mode="padding"
        style={styles.safeArea}
      >
        {content}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function visibleInstalledApps(installed: readonly InstalledMiniApp[]): readonly InstalledMiniApp[] {
  return installed.filter((app) => !app.id.startsWith(DIAGNOSTIC_APP_ID_PREFIX));
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
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
    color: colors.textMuted,
    fontSize: 15,
  },
  errorContainer: {
    padding: 18,
  },
  missingCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.card,
    borderWidth: 1,
    gap: 10,
    margin: 18,
    padding: 18,
  },
  missingTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
  },
  missingText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  returnButton: {
    alignSelf: "flex-start",
    backgroundColor: colors.brand,
    borderRadius: radii.button,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  returnButtonText: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: "700",
  },
});
