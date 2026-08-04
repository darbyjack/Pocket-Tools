import {
  canScheduleExactAlarms,
  ensureNativeNotificationChannel,
  getNativeNotificationOpenTarget,
  nativeNotificationsEnabled,
  openExactAlarmSettings,
  openNotificationSettings,
  reconcileNativeNotifications,
  type NativeNotificationRegistryEntry,
  type NativeNotificationReconciliationResult,
} from "@pocket-tools/notifications-runtime";
import * as SQLite from "expo-sqlite";
import { PermissionsAndroid, Platform } from "react-native";

import {
  extractNotificationHostId,
  normalizeNotificationOpenTarget,
  type NotificationRouteTarget,
} from "./notification-routing.ts";
import {
  completeNotificationCancellation,
  listNotificationRegistryEntries,
  markNotificationReconciliationProblem,
  markNotificationScheduled,
  replaceDesiredNotificationsInTransaction,
  type NotificationRegistryEntry,
} from "../storage/notification-registry.ts";

export { describeNotificationTrigger } from "./notification-routing.ts";
export type { NotificationRouteTarget } from "./notification-routing.ts";

const databasePromise = SQLite.openDatabaseAsync("pocket-tools.db");

export type HostNotificationPermission = "granted" | "denied";

export interface HostNotificationStatus {
  readonly permission: HostNotificationPermission;
  readonly notificationsEnabled: boolean;
  readonly exactAlarmAccess: boolean;
  readonly desired: number;
  readonly scheduled: number;
  readonly blocked: number;
  readonly failed: number;
}

let reconciliationTail: Promise<void> = Promise.resolve();

export async function ensureHostNotificationInfrastructure(): Promise<void> {
  ensureNativeNotificationChannel();
}

export async function getHostNotificationStatus(): Promise<HostNotificationStatus> {
  await ensureHostNotificationInfrastructure();
  const [permission, entries] = await Promise.all([
    getAndroidNotificationPermission(),
    listRegistryEntries(),
  ]);
  return summarizeStatus(permission, entries);
}

export async function requestHostNotificationPermission(): Promise<HostNotificationStatus> {
  await ensureHostNotificationInfrastructure();
  if (requiresRuntimeNotificationPermission()) {
    await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  }
  await reconcileHostNotifications();
  return getHostNotificationStatus();
}

export async function openHostNotificationSettings(): Promise<boolean> {
  return openNotificationSettings();
}

export async function openHostExactAlarmSettings(): Promise<boolean> {
  return openExactAlarmSettings();
}

export function reconcileHostNotifications(): Promise<void> {
  const run = reconciliationTail
    .catch(() => undefined)
    .then(async () => {
      await ensureHostNotificationInfrastructure();
      const database = await databasePromise;
      const entries = await listNotificationRegistryEntries(database);
      const nativeEntries = entries.map(toNativeEntry);
      const results = await reconcileNativeNotifications(nativeEntries);
      await database.withTransactionAsync(async () => {
        for (const result of results) {
          await persistNativeResult(database, result);
        }
      });
    });
  reconciliationTail = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export async function listToolNotificationEntries(
  storageId: string,
): Promise<readonly NotificationRegistryEntry[]> {
  const entries = await listRegistryEntries();
  return entries.filter((entry) => entry.storageId === storageId);
}

export async function cancelAllToolNotifications(storageId: string): Promise<void> {
  const database = await databasePromise;
  const updatedAt = new Date().toISOString();
  await database.withTransactionAsync(async () => {
    await replaceDesiredNotificationsInTransaction(database, storageId, [], updatedAt);
  });
  await reconcileHostNotifications();
}

export function resolveNotificationUrl(url: string): NotificationRouteTarget | null {
  const hostId = extractNotificationHostId(url);
  if (hostId === null) return null;
  return normalizeNotificationOpenTarget(getNativeNotificationOpenTarget(hostId));
}

async function getAndroidNotificationPermission(): Promise<HostNotificationPermission> {
  if (!requiresRuntimeNotificationPermission()) return "granted";
  const granted = await PermissionsAndroid.check(
    PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
  );
  return granted ? "granted" : "denied";
}

function requiresRuntimeNotificationPermission(): boolean {
  return Platform.OS === "android" && typeof Platform.Version === "number" && Platform.Version >= 33;
}

async function listRegistryEntries(): Promise<readonly NotificationRegistryEntry[]> {
  const database = await databasePromise;
  return listNotificationRegistryEntries(database);
}

function toNativeEntry(entry: NotificationRegistryEntry): NativeNotificationRegistryEntry {
  return {
    hostId: entry.hostId,
    storageId: entry.storageId,
    notificationId: entry.notificationId,
    desired: entry.desired,
    ...(entry.request === undefined
      ? {}
      : { request: entry.request as unknown as Readonly<Record<string, unknown>> }),
  };
}

async function persistNativeResult(
  database: SQLite.SQLiteDatabase,
  result: NativeNotificationReconciliationResult,
): Promise<void> {
  const reconciledAt = new Date().toISOString();
  if (result.status === "scheduled") {
    await markNotificationScheduled(
      database,
      result.storageId,
      result.notificationId,
      result.platformId ?? result.hostId,
      reconciledAt,
    );
    return;
  }
  if (result.status === "blocked" || result.status === "failed") {
    await markNotificationReconciliationProblem(
      database,
      result.storageId,
      result.notificationId,
      result.status,
      result.message ?? "Android could not reconcile this reminder.",
      reconciledAt,
    );
    return;
  }
  if (result.status === "cancelled") {
    await completeNotificationCancellation(database, result.storageId, result.notificationId);
    return;
  }
  await database.runAsync(
    `DELETE FROM notification_registry
     WHERE storage_id = ? AND notification_id = ? AND desired = 1`,
    result.storageId,
    result.notificationId,
  );
}

function summarizeStatus(
  permission: HostNotificationPermission,
  entries: readonly NotificationRegistryEntry[],
): HostNotificationStatus {
  return {
    permission,
    notificationsEnabled: nativeNotificationsEnabled(),
    exactAlarmAccess: canScheduleExactAlarms(),
    desired: entries.filter((entry) => entry.desired).length,
    scheduled: entries.filter((entry) => entry.desired && entry.status === "scheduled").length,
    blocked: entries.filter((entry) => entry.desired && entry.status === "blocked").length,
    failed: entries.filter((entry) => entry.desired && entry.status === "failed").length,
  };
}
