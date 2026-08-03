import { deleteInstalledMiniApp, listInstalledMiniApps } from "../storage/database";
import { isDiagnosticAppId } from "../storage/namespaces";
import { loadTimerRecoveryCheckpoint } from "./checkpoint";

export async function cleanupAbandonedLifecycleDiagnostics(): Promise<void> {
  const checkpoint = await loadTimerRecoveryCheckpoint();
  const installed = await listInstalledMiniApps();
  const abandoned = installed.filter(
    (app) => isDiagnosticAppId(app.id) && app.id !== checkpoint?.appId,
  );

  for (const app of abandoned) {
    await deleteInstalledMiniApp(app.id, true);
  }
}
