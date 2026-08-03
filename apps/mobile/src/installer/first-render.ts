import type {
  MiniAppInspection,
  RuntimeSnapshot,
  SerializableValue,
} from "../model";
import { renderMiniApp } from "../runtime/quickjs";
import { validatePageNode } from "../runtime/ui-validation";
import { loadRuntimeSnapshot } from "../storage/database";

export async function assertFirstRenderAgainstRetainedState(
  source: string,
  inspection: MiniAppInspection,
): Promise<void> {
  const snapshot = await loadRuntimeSnapshot(
    inspection,
    inspection.manifest.id,
    "render",
    { screen: "home" },
  );
  const settings: Record<string, SerializableValue> = {
    ...snapshot.settings,
  };
  for (const [name, definition] of Object.entries(inspection.settings)) {
    if (!(name in settings)) settings[name] = definition.default;
  }

  const candidateSnapshot: RuntimeSnapshot = {
    ...snapshot,
    settings,
  };
  const response = await renderMiniApp(source, candidateSnapshot);
  if (response.value.page === undefined) {
    throw new Error("INSTALLATION_FAILED: The candidate returned no home page.");
  }
  validatePageNode(response.value.page, inspection);
}
