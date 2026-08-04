import {
  canScheduleExactAlarms,
  ensureNativeNotificationChannel,
  getNativeNotificationOpenTarget,
  nativeNotificationsEnabled,
  openExactAlarmSettings,
  openNotificationSettings,
  reconcileNativeNotifications,
  type NativeNotificationOpenTarget,
  type NativeNotificationRegistryEntry,
  type NativeNotificationReconciliationResult,
} from "@pocket-tools/notifications-runtime";
import { isSerializableValue } from "@pocket-tools/sdk-contract";
import * as Notifications from "expo-notifications";
import * as SQLite from "expo-sqlite";

import type { NotificationRequest, SerializableValue } from "../model.ts";
import {
  completeNotificationCancellation,
  listNotificationRegistryEntries,
  markNotificationReconciliationProblem,
  markNotificationScheduled,
  replaceDesiredNotificationsInTransaction,
  type NotificationRegistryEntry,
} from "../storage/notification-registry.ts";

const CHANNEL_ID = "pocket-tools-reminders";
const databasePromise = SQLite.openDatabaseAsync("pocket-tools.db");

export type HostNotificationPermission = "granted" | "denied" | "undetermined";

export interface HostNotificationStatus {
  readonly permission: HostNotificationPermission;
  readonly notificationsEnabled: boolean;
  readonly exactAlarmAccess: boolean;
  readonly desired: number;
  readonly scheduled: number;
  readonly blocked: number;
  readonly failed: number;
}

export interface NotificationRouteTarget {
  readonly hostId: string;
  readonly storageId: string;
  readonly notificationId: string;
  readonly screen: string;
  readonly input?: SerializableValue;
}

let reconciliationTail: Promise<void> = Promise.resolve();

export async function ensureHostNotificationInfrastructure(): Promise<void> {
  ensureNativeNotificationChannel();
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: "Pocket Tools reminders",
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

export async function getHostNotificationStatus(): Promise<HostNotificationStatus> {
  await ensureHostNotificationInfrastructure();
  const [permissions, entries] = await Promise.all([
    Notifications.getPermissionsAsync(),
    listRegistryEntries(),
  ]);
  return summarizeStatus(normalizePermission(permissions.status), entries);
}

export async function requestHostNotificationPermission(): Promise<HostNotificationStatus> {
  await ensureHostNotificationInfrastructure();
  await Notifications.requestPermissionsAsync();
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
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "pocket-tools:" || parsed.hostname !== "notification") return null;
  const hostId = parsed.searchParams.get("hostId");
  if (hostId === null || hostId.length === 0) return null;
  return normalizeNativeOpenTarget(getNativeNotificationOpenTarget(hostId));
}

export function describeNotificationTrigger(request: NotificationRequest): string {
  const trigger = request.trigger;
  if (trigger.type === "immediate") return "Immediate";
  if (trigger.type === "date") return `Once at ${new Date(trigger.at).toLocaleString()}`;
  const time = new Date(2000, 0, 1, trigger.hour, trigger.minute).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
  if (trigger.type === "daily") return `Daily at ${time}`;
  const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  return `${weekdays[trigger.weekday - 1]} at ${time}`;
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

function normalizeNativeOpenTarget(
  target: NativeNotificationOpenTarget | null,
): NotificationRouteTarget | null {
  if (target === null) return null;
  if (
    typeof target.hostId !== "string" ||
    typeof target.storageId !== "string" ||
    typeof target.notificationId !== "string" ||
    target.hostId.length === 0 ||
    target.storageId.length === 0 ||
    target.notificationId.length === 0
  ) {
    throw new Error("NOTIFICATION_ROUTE_INVALID: Native routing identity is invalid.");
  }
  const screen = target.screen ?? "home";
  if (!/^[a-z][A-Za-z0-9]*$/.test(screen)) {
    throw new Error("NOTIFICATION_ROUTE_INVALID: Native routing screen is invalid.");
  }
  if (target.input !== undefined && !isSerializableValue(target.input)) {
    throw new Error("NOTIFICATION_ROUTE_INVALID: Native routing input is invalid.");
  }
  return {
    hostId: target.hostId,
    storageId: target.storageId,
    notificationId: target.notificationId,
    screen,
    ...(target.input === undefined ? {} : { input: target.input }),
  };
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

function normalizePermission(status: string): HostNotificationPermission {
  if (status === "granted") return "granted";
  if (status === "denied") return "denied";
  return "undetermined";
}
