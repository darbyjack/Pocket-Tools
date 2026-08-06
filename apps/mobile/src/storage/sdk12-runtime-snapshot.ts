import type { MiniAppInspection, NotificationRequest, RuntimeSnapshot } from "../model.ts";
import { getDatabase } from "./database-connection.ts";
import { loadRuntimeSnapshot } from "./database.ts";
import { readDesiredNotificationRequests } from "./notification-registry.ts";

export interface Sdk12RuntimeSnapshot extends RuntimeSnapshot {
  readonly notifications: Readonly<Record<string, NotificationRequest>>;
}

export async function loadSdk12RuntimeSnapshot(
  inspection: MiniAppInspection,
  storageId: string,
  mode: RuntimeSnapshot["mode"],
  options: { readonly action?: string; readonly screen?: string } = {},
): Promise<Sdk12RuntimeSnapshot> {
  if ((inspection.manifest.sdkVersion as string) !== "1.2") {
    throw new Error("UNSUPPORTED_SDK_VERSION: Notification snapshots require SDK 1.2.");
  }
  const database = await getDatabase();
  const [snapshot, requests] = await Promise.all([
    loadRuntimeSnapshot(inspection, storageId, mode, options),
    readDesiredNotificationRequests(database, storageId),
  ]);
  return {
    ...snapshot,
    notifications: Object.fromEntries(requests.map((request) => [request.id, request])),
  };
}
