import * as SQLite from "expo-sqlite";

import type { MiniAppInspection, SerializableValue } from "../model";
import { inspectMiniApp } from "../runtime/quickjs";
import {
  MINI_APP_BACKUP_FORMAT,
  MINI_APP_BACKUP_VERSION,
  parseMiniAppBackup,
  validateMiniAppBackupForRestore,
  type MiniAppBackupV1,
} from "./backup";
import { getInstalledMiniApp, type InstalledMiniApp } from "./database";

const databasePromise = SQLite.openDatabaseAsync("pocket-tools.db");

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

export interface RestoreMiniAppBackupOptions {
  readonly replaceExisting?: boolean;
}

export async function createMiniAppBackup(appId: string): Promise<MiniAppBackupV1> {
  const app = await getInstalledMiniApp(appId);
  if (app === null) throw new Error(`BACKUP_NOT_FOUND: ${appId} is not installed.`);

  const [activeInspection, lastKnownGoodInspection] = await Promise.all([
    inspectMiniApp(app.activeSource),
    inspectMiniApp(app.lastKnownGoodSource),
  ]);

  const database = await databasePromise;
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
  });
  validateMiniAppBackupForRestore(backup, activeInspection, lastKnownGoodInspection);
  return backup;
}

export async function restoreMiniAppBackup(
  backup: MiniAppBackupV1,
  activeInspection: MiniAppInspection,
  lastKnownGoodInspection: MiniAppInspection,
  options: RestoreMiniAppBackupOptions = {},
): Promise<InstalledMiniApp> {
  const parsed = parseMiniAppBackup(backup);
  validateMiniAppBackupForRestore(parsed, activeInspection, lastKnownGoodInspection);

  const database = await databasePromise;
  try {
    await database.withTransactionAsync(async () => {
      const existing = await database.getFirstAsync<{ readonly app_id: string }>(
        "SELECT app_id FROM installed_mini_apps WHERE app_id = ?",
        parsed.app.id,
      );
      if (existing !== null && options.replaceExisting !== true) {
        throw new Error(
          `BACKUP_CONFLICT: ${parsed.app.id} is already installed. Explicit replacement is required.`,
        );
      }

      if (existing !== null) {
        await database.runAsync("DELETE FROM installed_mini_apps WHERE app_id = ?", parsed.app.id);
        await clearStateInTransaction(database, parsed.app.id);
      }

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
    if (cause instanceof Error && /^BACKUP_(?:CONFLICT|INVALID):/.test(cause.message)) throw cause;
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
