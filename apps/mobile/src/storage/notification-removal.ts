import { getDatabase } from "./database-connection.ts";
import { cancelNotificationsForRemovedToolInTransaction } from "./notification-registry.ts";

export async function deleteInstalledMiniAppWithNotifications(
  appId: string,
  deleteData: boolean,
): Promise<void> {
  const database = await getDatabase();
  await database.withTransactionAsync(async () => {
    const removedAt = new Date().toISOString();
    await cancelNotificationsForRemovedToolInTransaction(database, appId, removedAt);
    await database.runAsync("DELETE FROM installed_mini_apps WHERE app_id = ?", appId);
    if (!deleteData) return;
    await database.runAsync("DELETE FROM settings WHERE app_id = ?", appId);
    await database.runAsync("DELETE FROM records WHERE app_id = ?", appId);
    await database.runAsync("DELETE FROM timers WHERE app_id = ?", appId);
  });
}
