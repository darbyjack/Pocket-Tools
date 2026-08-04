import * as SQLite from "expo-sqlite";

import type { NotificationRequest } from "../model.ts";
import {
  cancelAllToolNotifications,
  listToolNotificationEntries,
  reconcileHostNotifications,
} from "../notifications/host-notifications.ts";
import { inspectMiniApp } from "../runtime/quickjs.ts";
import { getInstalledMiniApp, installMiniApp } from "../storage/database.ts";
import { deleteInstalledMiniAppWithNotifications } from "../storage/notification-removal.ts";
import {
  applyPreparedNotificationOperation,
  ensureNotificationRegistrySchema,
  type NotificationRegistryEntry,
} from "../storage/notification-registry.ts";
import {
  createNotificationAcceptanceSource,
  NOTIFICATION_ACCEPTANCE_APP_ID,
  NOTIFICATION_ACCEPTANCE_APP_NAME,
} from "./fixtures.ts";

const databasePromise = SQLite.openDatabaseAsync("pocket-tools.db");

type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type NotificationAcceptanceKind =
  | "immediate"
  | "standardDate"
  | "exactDate"
  | "daily"
  | "weekly"
  | "replacementA"
  | "replacementB";

export interface NotificationAcceptanceStatus {
  readonly installed: boolean;
  readonly entries: readonly NotificationRegistryEntry[];
}

export async function getNotificationAcceptanceStatus(): Promise<NotificationAcceptanceStatus> {
  const installed = (await getInstalledMiniApp(NOTIFICATION_ACCEPTANCE_APP_ID)) !== null;
  const entries = installed
    ? await listToolNotificationEntries(NOTIFICATION_ACCEPTANCE_APP_ID)
    : [];
  return { installed, entries };
}

export async function installNotificationAcceptanceFixture(): Promise<void> {
  if ((await getInstalledMiniApp(NOTIFICATION_ACCEPTANCE_APP_ID)) !== null) return;
  const source = createNotificationAcceptanceSource();
  const inspection = await inspectMiniApp(source);
  if (
    inspection.manifest.id !== NOTIFICATION_ACCEPTANCE_APP_ID ||
    inspection.manifest.name !== NOTIFICATION_ACCEPTANCE_APP_NAME ||
    inspection.manifest.sdkVersion !== "1.0"
  ) {
    throw new Error("The notification acceptance fixture inspection is invalid.");
  }
  await installMiniApp(inspection, source);
}

export async function removeNotificationAcceptanceFixture(): Promise<void> {
  if ((await getInstalledMiniApp(NOTIFICATION_ACCEPTANCE_APP_ID)) === null) return;
  await deleteInstalledMiniAppWithNotifications(NOTIFICATION_ACCEPTANCE_APP_ID, true);
  await reconcileHostNotifications();
}

export async function scheduleNotificationAcceptance(
  kind: NotificationAcceptanceKind,
): Promise<NotificationAcceptanceStatus> {
  await installNotificationAcceptanceFixture();
  const now = new Date();
  const request = buildRequest(kind, now);
  const database = await databasePromise;
  await ensureNotificationRegistrySchema(database);
  await database.withTransactionAsync(async () => {
    await applyPreparedNotificationOperation(
      database,
      NOTIFICATION_ACCEPTANCE_APP_ID,
      {
        index: -1,
        operation: {
          type: "notification-schedule",
          request,
        },
      },
      now.toISOString(),
    );
  });
  await reconcileHostNotifications();
  return getNotificationAcceptanceStatus();
}

export async function cancelNotificationAcceptance(): Promise<NotificationAcceptanceStatus> {
  await cancelAllToolNotifications(NOTIFICATION_ACCEPTANCE_APP_ID);
  return getNotificationAcceptanceStatus();
}

function buildRequest(kind: NotificationAcceptanceKind, now: Date): NotificationRequest {
  const open = {
    screen: "details",
    input: {
      kind,
      createdAt: now.toISOString(),
    },
  } as const;

  if (kind === "immediate") {
    return {
      id: "immediateReminder",
      title: "Pocket Tools immediate test",
      body: "Tap to verify routing into the acceptance tool.",
      trigger: { type: "immediate" },
      open,
    };
  }

  if (kind === "standardDate" || kind === "exactDate") {
    const exact = kind === "exactDate";
    const at = new Date(now.getTime() + (exact ? 3 : 2) * 60_000).toISOString();
    return {
      id: exact ? "exactReminder" : "standardReminder",
      title: exact ? "Pocket Tools exact test" : "Pocket Tools standard test",
      body: exact ? "Exact reminder acceptance." : "Standard reminder acceptance.",
      trigger: {
        type: "date",
        at,
        delivery: exact ? "exact" : "standard",
      },
      open,
    };
  }

  if (kind === "daily" || kind === "weekly") {
    const target = new Date(now.getTime() + 2 * 60_000);
    const hour = target.getHours();
    const minute = target.getMinutes();
    const trigger =
      kind === "daily"
        ? ({ type: "daily", hour, minute, delivery: "standard" } as const)
        : ({
            type: "weekly",
            weekday: isoWeekday(target),
            hour,
            minute,
            delivery: "standard",
          } as const);
    return {
      id: kind === "daily" ? "dailyReminder" : "weeklyReminder",
      title: kind === "daily" ? "Pocket Tools daily test" : "Pocket Tools weekly test",
      body: "Recurring reminder acceptance.",
      trigger,
      open,
    };
  }

  return {
    id: "replacementReminder",
    title:
      kind === "replacementA"
        ? "Pocket Tools replacement A"
        : "Pocket Tools replacement B",
    body: "Only the most recently scheduled replacement should fire.",
    trigger: {
      type: "date",
      at: new Date(now.getTime() + 3 * 60_000).toISOString(),
      delivery: "standard",
    },
    open,
  };
}

function isoWeekday(date: Date): IsoWeekday {
  const weekday = date.getDay();
  if (weekday === 0) return 7;
  if (weekday >= 1 && weekday <= 6) return weekday as 1 | 2 | 3 | 4 | 5 | 6;
  throw new Error("The device returned an invalid weekday.");
}
