import type * as SQLite from "expo-sqlite";

import type { MiniAppInspection, NotificationRequest, RuntimeOperation } from "../model.ts";
import {
  assertNotificationId,
  normalizeNotificationRequest,
  notificationUsesExactDelivery,
  parseNotificationRequestShape,
} from "../runtime/notification-validation.ts";

export const MAX_DESIRED_NOTIFICATIONS = 64;

export type NotificationReconciliationStatus = "pending" | "scheduled" | "blocked" | "failed";

interface NotificationRegistryRow {
  readonly storage_id: string;
  readonly notification_id: string;
  readonly desired: number;
  readonly request_json: string | null;
  readonly platform_id: string | null;
  readonly status: NotificationReconciliationStatus;
  readonly last_error: string | null;
  readonly updated_at: string;
  readonly reconciled_at: string | null;
}

export interface NotificationRegistryEntry {
  readonly storageId: string;
  readonly notificationId: string;
  readonly hostId: string;
  readonly desired: boolean;
  readonly request?: NotificationRequest;
  readonly platformId?: string;
  readonly status: NotificationReconciliationStatus;
  readonly lastError?: string;
  readonly updatedAt: string;
  readonly reconciledAt?: string;
}

export interface NotificationOperationPreflight {
  readonly now: string;
  readonly exactAlarmAccess: boolean;
}

export type PreparedNotificationOperation =
  | {
      readonly index: number;
      readonly operation: {
        readonly type: "notification-schedule";
        readonly request: NotificationRequest;
      };
    }
  | {
      readonly index: number;
      readonly operation: {
        readonly type: "notification-cancel";
        readonly notificationId: string;
      };
    }
  | {
      readonly index: number;
      readonly operation: { readonly type: "notification-cancel-all" };
    };

export async function ensureNotificationRegistrySchema(
  database: SQLite.SQLiteDatabase,
): Promise<void> {
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS notification_registry (
      storage_id TEXT NOT NULL,
      notification_id TEXT NOT NULL,
      desired INTEGER NOT NULL CHECK (desired IN (0, 1)),
      request_json TEXT,
      platform_id TEXT,
      status TEXT NOT NULL CHECK (status IN ('pending', 'scheduled', 'blocked', 'failed')),
      last_error TEXT,
      updated_at TEXT NOT NULL,
      reconciled_at TEXT,
      PRIMARY KEY (storage_id, notification_id),
      CHECK (
        (desired = 1 AND request_json IS NOT NULL)
        OR (desired = 0 AND request_json IS NULL)
      )
    );

    CREATE INDEX IF NOT EXISTS notification_registry_reconcile
      ON notification_registry (status, desired, storage_id, notification_id);
  `);
}

export async function prepareNotificationOperations(
  database: SQLite.SQLiteDatabase,
  inspection: MiniAppInspection,
  storageId: string,
  operations: readonly RuntimeOperation[],
  preflight: NotificationOperationPreflight,
): Promise<ReadonlyMap<number, PreparedNotificationOperation>> {
  const notificationIndexes = operations
    .map((operation, index) => ({ operation, index }))
    .filter(({ operation }) => operation.type.startsWith("notification-"));
  if (notificationIndexes.length === 0) return new Map();

  if ((inspection.manifest.sdkVersion as string) !== "1.2") {
    throw new Error("UNSUPPORTED_SDK_VERSION: Notification operations require SDK 1.2.");
  }

  const desiredRows = await database.getAllAsync<{ readonly notification_id: string }>(
    `SELECT notification_id
     FROM notification_registry
     WHERE storage_id = ? AND desired = 1
     ORDER BY notification_id ASC`,
    storageId,
  );
  const desired = new Set(desiredRows.map((row) => row.notification_id));
  const prepared = new Map<number, PreparedNotificationOperation>();

  for (const { operation, index } of notificationIndexes) {
    if (operation.type === "notification-schedule") {
      const request = normalizeNotificationRequest(
        operation.request,
        inspection,
        `operations[${index}].request`,
        { now: preflight.now, requireFutureDate: true },
      );
      if (notificationUsesExactDelivery(request) && !preflight.exactAlarmAccess) {
        throw new Error(
          "NOTIFICATION_EXACT_PERMISSION_REQUIRED: Exact reminders require Alarms & reminders access.",
        );
      }
      desired.add(request.id);
      if (desired.size > MAX_DESIRED_NOTIFICATIONS) {
        throw notificationLimitError();
      }
      prepared.set(index, {
        index,
        operation: { type: "notification-schedule", request },
      });
      continue;
    }

    if (operation.type === "notification-cancel") {
      const notificationId = assertNotificationId(
        operation.notificationId,
        `operations[${index}].notificationId`,
      );
      desired.delete(notificationId);
      prepared.set(index, {
        index,
        operation: { type: "notification-cancel", notificationId },
      });
      continue;
    }

    if (operation.type === "notification-cancel-all") {
      desired.clear();
      prepared.set(index, { index, operation: { type: "notification-cancel-all" } });
      continue;
    }

    throw new Error(`INVALID_OPERATION: operations[${index}] has an unsupported type.`);
  }

  return prepared;
}

export async function applyPreparedNotificationOperation(
  database: SQLite.SQLiteDatabase,
  storageId: string,
  prepared: PreparedNotificationOperation,
  updatedAt: string,
): Promise<void> {
  const operation = prepared.operation;
  if (operation.type === "notification-schedule") {
    await assertScheduleCapacityInTransaction(database, storageId, operation.request.id);
    await database.runAsync(
      `INSERT INTO notification_registry (
         storage_id, notification_id, desired, request_json, platform_id,
         status, last_error, updated_at, reconciled_at
       ) VALUES (?, ?, 1, ?, NULL, 'pending', NULL, ?, NULL)
       ON CONFLICT(storage_id, notification_id) DO UPDATE SET
         desired = 1,
         request_json = excluded.request_json,
         status = 'pending',
         last_error = NULL,
         updated_at = excluded.updated_at,
         reconciled_at = NULL`,
      storageId,
      operation.request.id,
      JSON.stringify(operation.request),
      updatedAt,
    );
    return;
  }

  if (operation.type === "notification-cancel") {
    await cancelOneInTransaction(database, storageId, operation.notificationId, updatedAt);
    return;
  }

  await cancelAllInTransaction(database, storageId, updatedAt);
}

export async function listNotificationRegistryEntries(
  database: SQLite.SQLiteDatabase,
): Promise<readonly NotificationRegistryEntry[]> {
  await ensureNotificationRegistrySchema(database);
  const rows = await readRegistryRows(database);
  return rows.map(mapRegistryRow);
}

export async function listNotificationReconciliationEntries(
  database: SQLite.SQLiteDatabase,
): Promise<readonly NotificationRegistryEntry[]> {
  await ensureNotificationRegistrySchema(database);
  const rows = await readRegistryRows(database);
  return rows.map(mapRegistryRow);
}

export async function readDesiredNotificationRequests(
  database: SQLite.SQLiteDatabase,
  storageId: string,
): Promise<readonly NotificationRequest[]> {
  await ensureNotificationRegistrySchema(database);
  const rows = await database.getAllAsync<{
    readonly notification_id: string;
    readonly request_json: string;
  }>(
    `SELECT notification_id, request_json
     FROM notification_registry
     WHERE storage_id = ? AND desired = 1
     ORDER BY notification_id ASC`,
    storageId,
  );
  return rows.map((row) => parseStoredRequest(row.request_json, row.notification_id));
}

export async function replaceDesiredNotificationsInTransaction(
  database: SQLite.SQLiteDatabase,
  storageId: string,
  requests: readonly NotificationRequest[],
  updatedAt: string,
): Promise<void> {
  await cancelAllInTransaction(database, storageId, updatedAt);
  for (const request of requests) {
    await applyPreparedNotificationOperation(
      database,
      storageId,
      { index: -1, operation: { type: "notification-schedule", request } },
      updatedAt,
    );
  }
}

export async function cancelNotificationsForRemovedToolInTransaction(
  database: SQLite.SQLiteDatabase,
  storageId: string,
  updatedAt: string,
): Promise<void> {
  await cancelAllInTransaction(database, storageId, updatedAt);
}

export async function prepareNotificationRegistryForHostRestoreInTransaction(
  database: SQLite.SQLiteDatabase,
  updatedAt: string,
): Promise<void> {
  await database.runAsync("DELETE FROM notification_registry WHERE platform_id IS NULL");
  await database.runAsync(
    `UPDATE notification_registry
     SET desired = 0, request_json = NULL, status = 'pending',
         last_error = NULL, updated_at = ?, reconciled_at = NULL
     WHERE platform_id IS NOT NULL`,
    updatedAt,
  );
}

export async function markNotificationScheduled(
  database: SQLite.SQLiteDatabase,
  storageId: string,
  notificationId: string,
  platformId: string,
  reconciledAt = new Date().toISOString(),
): Promise<void> {
  const result = await database.runAsync(
    `UPDATE notification_registry
     SET platform_id = ?, status = 'scheduled', last_error = NULL, reconciled_at = ?
     WHERE storage_id = ? AND notification_id = ? AND desired = 1`,
    platformId,
    reconciledAt,
    storageId,
    notificationId,
  );
  if (result.changes !== 1) {
    throw missingRegistryRow(storageId, notificationId, "desired schedule");
  }
}

export async function markNotificationReconciliationProblem(
  database: SQLite.SQLiteDatabase,
  storageId: string,
  notificationId: string,
  status: "blocked" | "failed",
  message: string,
  reconciledAt = new Date().toISOString(),
): Promise<void> {
  const result = await database.runAsync(
    `UPDATE notification_registry
     SET status = ?, last_error = ?, reconciled_at = ?
     WHERE storage_id = ? AND notification_id = ?`,
    status,
    message,
    reconciledAt,
    storageId,
    notificationId,
  );
  if (result.changes !== 1) {
    throw missingRegistryRow(storageId, notificationId, "registry row");
  }
}

export async function completeNotificationCancellation(
  database: SQLite.SQLiteDatabase,
  storageId: string,
  notificationId: string,
): Promise<void> {
  await database.runAsync(
    `DELETE FROM notification_registry
     WHERE storage_id = ? AND notification_id = ? AND desired = 0`,
    storageId,
    notificationId,
  );
}

export function notificationHostId(storageId: string, notificationId: string): string {
  return `pocket-tools:${storageId.length}:${storageId}:${notificationId}`;
}

async function readRegistryRows(
  database: SQLite.SQLiteDatabase,
): Promise<readonly NotificationRegistryRow[]> {
  return database.getAllAsync<NotificationRegistryRow>(
    `SELECT storage_id, notification_id, desired, request_json, platform_id,
            status, last_error, updated_at, reconciled_at
     FROM notification_registry
     ORDER BY storage_id ASC, notification_id ASC`,
  );
}

async function assertScheduleCapacityInTransaction(
  database: SQLite.SQLiteDatabase,
  storageId: string,
  notificationId: string,
): Promise<void> {
  const existing = await database.getFirstAsync<{ readonly desired: number }>(
    `SELECT desired FROM notification_registry
     WHERE storage_id = ? AND notification_id = ?`,
    storageId,
    notificationId,
  );
  if (existing?.desired === 1) return;

  const count = await database.getFirstAsync<{ readonly count: number }>(
    `SELECT COUNT(*) AS count
     FROM notification_registry
     WHERE storage_id = ? AND desired = 1`,
    storageId,
  );
  if ((count?.count ?? 0) >= MAX_DESIRED_NOTIFICATIONS) {
    throw notificationLimitError();
  }
}

async function cancelOneInTransaction(
  database: SQLite.SQLiteDatabase,
  storageId: string,
  notificationId: string,
  updatedAt: string,
): Promise<void> {
  const row = await database.getFirstAsync<{ readonly platform_id: string | null }>(
    `SELECT platform_id FROM notification_registry
     WHERE storage_id = ? AND notification_id = ?`,
    storageId,
    notificationId,
  );
  if (row === null) return;
  if (row.platform_id === null) {
    await database.runAsync(
      "DELETE FROM notification_registry WHERE storage_id = ? AND notification_id = ?",
      storageId,
      notificationId,
    );
    return;
  }
  await database.runAsync(
    `UPDATE notification_registry
     SET desired = 0, request_json = NULL, status = 'pending',
         last_error = NULL, updated_at = ?, reconciled_at = NULL
     WHERE storage_id = ? AND notification_id = ?`,
    updatedAt,
    storageId,
    notificationId,
  );
}

async function cancelAllInTransaction(
  database: SQLite.SQLiteDatabase,
  storageId: string,
  updatedAt: string,
): Promise<void> {
  await database.runAsync(
    "DELETE FROM notification_registry WHERE storage_id = ? AND platform_id IS NULL",
    storageId,
  );
  await database.runAsync(
    `UPDATE notification_registry
     SET desired = 0, request_json = NULL, status = 'pending',
         last_error = NULL, updated_at = ?, reconciled_at = NULL
     WHERE storage_id = ? AND platform_id IS NOT NULL`,
    updatedAt,
    storageId,
  );
}

function mapRegistryRow(row: NotificationRegistryRow): NotificationRegistryEntry {
  const request =
    row.desired === 1 && row.request_json !== null
      ? parseStoredRequest(row.request_json, row.notification_id)
      : undefined;
  return {
    storageId: row.storage_id,
    notificationId: row.notification_id,
    hostId: notificationHostId(row.storage_id, row.notification_id),
    desired: row.desired === 1,
    ...(request === undefined ? {} : { request }),
    ...(row.platform_id === null ? {} : { platformId: row.platform_id }),
    status: row.status,
    ...(row.last_error === null ? {} : { lastError: row.last_error }),
    updatedAt: row.updated_at,
    ...(row.reconciled_at === null ? {} : { reconciledAt: row.reconciled_at }),
  };
}

function parseStoredRequest(json: string, notificationId: string): NotificationRequest {
  let value: unknown;
  try {
    value = JSON.parse(json) as unknown;
  } catch (cause) {
    throw new Error(
      `NOTIFICATION_RECONCILIATION_FAILED: Stored request ${notificationId} is invalid JSON.`,
      { cause },
    );
  }

  let request: NotificationRequest;
  try {
    request = parseNotificationRequestShape(value, `notification_registry.${notificationId}`);
  } catch (cause) {
    throw new Error(
      `NOTIFICATION_RECONCILIATION_FAILED: Stored request ${notificationId} is invalid.`,
      { cause },
    );
  }
  if (request.id !== notificationId) {
    throw new Error(
      `NOTIFICATION_RECONCILIATION_FAILED: Stored request identity ${notificationId} changed.`,
    );
  }
  return request;
}

function notificationLimitError(): Error {
  return new Error(
    `NOTIFICATION_LIMIT_EXCEEDED: A tool may own at most ${MAX_DESIRED_NOTIFICATIONS} desired schedules.`,
  );
}

function missingRegistryRow(storageId: string, notificationId: string, kind: string): Error {
  return new Error(
    `NOTIFICATION_RECONCILIATION_FAILED: Missing ${kind} ${storageId}.${notificationId}.`,
  );
}
