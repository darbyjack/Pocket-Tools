import { deleteInstalledMiniApp, listInstalledMiniApps } from "../storage/database";
import { isDiagnosticAppId } from "../storage/namespaces";
import { loadTimerRecoveryCheckpoint } from "./checkpoint";

export async function cleanupAbandonedLifecycleDiagnostics(): Promise<void> {
  const checkpoint = await loadTimerRecoveryCheckpoint();
  const installed = await listInstalledMiniApps();
  await Promise.all(
    installed
      .filter((app) => isDiagnosticAppId(app.id) && app.id !== checkpoint?.appId)
      .map((app) => deleteInstalledMiniApp(app.id, true)),
  );
}
