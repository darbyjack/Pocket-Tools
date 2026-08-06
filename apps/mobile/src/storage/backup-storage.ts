import type * as SQLite from "expo-sqlite";

import type { MiniAppInspection, SerializableValue } from "../model";
import { inspectMiniApp } from "../runtime/quickjs";
import {
  MINI_APP_BACKUP_FORMAT,
  MINI_APP_BACKUP_VERSION,
  parseMiniAppBackup,
  validateMiniAppBackupForRestore,
  type MiniAppBackupV2,
} from "./backup";
import { readPortableMiniAppBackup } from "./backup-version-dispatch";
import { getDatabase } from "./database-connection";
import { getInstalledMiniApp, type InstalledMiniApp } from "./database";
import {
  readDesiredNotificationRequests,
  replaceDesiredNotificationsInTransaction,
} from "./notification-registry";

interface BackupSettingRow {
  readonly name: string;
  readonly value_json: string;
}

interface BackupRecordRow {
  readonly id: string;
  readonly collection_name: string;
  readonly data_json: string;
  readonly created_at: string;
  readonly updated_at: string;
}

interface BackupTimerRow {
  readonly timer_id: string;
  readonly started_at: string;
}

interface StatePresenceRow {
  readonly has_state: number;
}

export interface RestoreMiniAppBackupOptions {
  readonly replaceExisting?: boolean;
}

export type MiniAppRestoreConflict =
  | { readonly kind: "installed"; readonly app: InstalledMiniApp }
  | { readonly kind: "retained-data"; readonly appId: string };

export async function createMiniAppBackup(appId: string): Promise<MiniAppBackupV2> {
  const app = await getInstalledMiniApp(appId);
  if (app === null) throw new Error(`BACKUP_NOT_FOUND: ${appId} is not installed.`);

  const [activeInspection, lastKnownGoodInspection] = await Promise.all([
    inspectMiniApp(app.activeSource),
    inspectMiniApp(app.lastKnownGoodSource),
  ]);

  const database = await getDatabase();
  const settingRows = await database.getAllAsync<BackupSettingRow>(
    `SELECT name, value_json
     FROM settings
     WHERE app_id = ?
     ORDER BY name ASC`,
    appId,
  );
  const recordRows = await database.getAllAsync<BackupRecordRow>(
    `SELECT id, collection_name, data_json, created_at, updated_at
     FROM records
     WHERE app_id = ?
     ORDER BY collection_name ASC, created_at ASC, id ASC`,
    appId,
  );
  const timerRows = await database.getAllAsync<BackupTimerRow>(
    `SELECT timer_id, started_at
     FROM timers
     WHERE app_id = ?
     ORDER BY timer_id ASC`,
    appId,
  );
  const notifications = await readDesiredNotificationRequests(database, appId);

  const backup = parseMiniAppBackup({
    format: MINI_APP_BACKUP_FORMAT,
    version: MINI_APP_BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    app: {
      id: app.id,
      name: app.name,
      ...(app.description === undefined ? {} : { description: app.description }),
      ...(app.icon === undefined ? {} : { icon: app.icon }),
      activeSource: app.activeSource,
      lastKnownGoodSource: app.lastKnownGoodSource,
      installedAt: app.installedAt,
      updatedAt: app.updatedAt,
    },
    settings: settingRows.map((row) => ({
      name: row.name,
      value: parseStoredValue(row.value_json, `settings.${row.name}`),
    })),
    records: recordRows.map((row) => ({
      id: row.id,
      collection: row.collection_name,
      data: parseStoredObject(row.data_json, `records.${row.id}`),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
    timers: timerRows.map((row) => ({
      id: row.timer_id,
      startedAt: row.started_at,
    })),
    notifications,
  });
  validateMiniAppBackupForRestore(backup, activeInspection, lastKnownGoodInspection);
  return backup;
}

export async function getMiniAppRestoreConflict(
  appId: string,
): Promise<MiniAppRestoreConflict | null> {
  const installed = await getInstalledMiniApp(appId);
  if (installed !== null) return { kind: "installed", app: installed };

  const database = await getDatabase();
  return (await hasStoredState(database, appId)) ? { kind: "retained-data", appId } : null;
}

export async function restoreMiniAppBackup(
  backup: unknown,
  activeInspection: MiniAppInspection,
  lastKnownGoodInspection: MiniAppInspection,
  options: RestoreMiniAppBackupOptions = {},
): Promise<InstalledMiniApp> {
  const parsed = readPortableMiniAppBackup(backup);
  validateMiniAppBackupForRestore(parsed, activeInspection, lastKnownGoodInspection);

  const database = await getDatabase();
  try {
    await database.withTransactionAsync(async () => {
      const existing = await database.getFirstAsync<{ readonly app_id: string }>(
        "SELECT app_id FROM installed_mini_apps WHERE app_id = ?",
        parsed.app.id,
      );
      const hasState = await hasStoredState(database, parsed.app.id);
      if ((existing !== null || hasState) && options.replaceExisting !== true) {
        throw new Error(
          `BACKUP_CONFLICT: ${parsed.app.id} already has an installation or retained data. Explicit replacement is required.`,
        );
      }

      await database.runAsync("DELETE FROM installed_mini_apps WHERE app_id = ?", parsed.app.id);
      await clearStateInTransaction(database, parsed.app.id);
      await replaceDesiredNotificationsInTransaction(
        database,
        parsed.app.id,
        parsed.notifications,
        new Date().toISOString(),
      );

      await database.runAsync(
        `INSERT INTO installed_mini_apps (
           app_id, name, description, icon, active_source,
           last_known_good_source, installed_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        parsed.app.id,
        parsed.app.name,
        parsed.app.description ?? null,
        parsed.app.icon ?? null,
        parsed.app.activeSource,
        parsed.app.lastKnownGoodSource,
        parsed.app.installedAt,
        parsed.app.updatedAt,
      );

      for (const setting of parsed.settings) {
        await database.runAsync(
          "INSERT INTO settings (app_id, name, value_json) VALUES (?, ?, ?)",
          parsed.app.id,
          setting.name,
          JSON.stringify(setting.value),
        );
      }

      for (const record of parsed.records) {
        await database.runAsync(
          `INSERT INTO records (
             id, app_id, collection_name, data_json, created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?)`,
          record.id,
          parsed.app.id,
          record.collection,
          JSON.stringify(record.data),
          record.createdAt,
          record.updatedAt,
        );
      }

      for (const timer of parsed.timers) {
        await database.runAsync(
          "INSERT INTO timers (app_id, timer_id, started_at) VALUES (?, ?, ?)",
          parsed.app.id,
          timer.id,
          timer.startedAt,
        );
      }
    });
  } catch (cause) {
    if (cause instanceof Error && /^BACKUP_(?:CONFLICT|INVALID|VERSION_)/.test(cause.message)) {
      throw cause;
    }
    throw new Error("BACKUP_RESTORE_FAILED: SQLite could not restore the mini app atomically.", {
      cause,
    });
  }

  const restored = await getInstalledMiniApp(parsed.app.id);
  if (restored === null) {
    throw new Error("BACKUP_RESTORE_FAILED: The restored mini app could not be reloaded.");
  }
  return restored;
}

async function hasStoredState(database: SQLite.SQLiteDatabase, appId: string): Promise<boolean> {
  const row = await database.getFirstAsync<StatePresenceRow>(
    `SELECT CASE WHEN
       EXISTS (SELECT 1 FROM settings WHERE app_id = ?)
       OR EXISTS (SELECT 1 FROM records WHERE app_id = ?)
       OR EXISTS (SELECT 1 FROM timers WHERE app_id = ?)
       OR EXISTS (
         SELECT 1 FROM notification_registry
         WHERE storage_id = ? AND desired = 1
       )
     THEN 1 ELSE 0 END AS has_state`,
    appId,
    appId,
    appId,
    appId,
  );
  return row?.has_state === 1;
}

async function clearStateInTransaction(
  database: SQLite.SQLiteDatabase,
  appId: string,
): Promise<void> {
  await database.runAsync("DELETE FROM settings WHERE app_id = ?", appId);
  await database.runAsync("DELETE FROM records WHERE app_id = ?", appId);
  await database.runAsync("DELETE FROM timers WHERE app_id = ?", appId);
}

function parseStoredValue(json: string, path: string): SerializableValue {
  try {
    return JSON.parse(json) as SerializableValue;
  } catch (cause) {
    throw new Error(`BACKUP_INVALID: Stored ${path} is not valid JSON.`, { cause });
  }
}

function parseStoredObject(
  json: string,
  path: string,
): Readonly<Record<string, SerializableValue>> {
  const value = parseStoredValue(json, path);
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`BACKUP_INVALID: Stored ${path} must be an object.`);
  }
  return value as Readonly<Record<string, SerializableValue>>;
}
