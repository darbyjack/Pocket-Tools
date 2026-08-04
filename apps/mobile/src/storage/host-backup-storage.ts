import * as SQLite from "expo-sqlite";

import type { MiniAppInspection, SerializableValue } from "../model.ts";
import { inspectMiniApp } from "../runtime/quickjs.ts";
import { validateMiniAppBackupForRestore, type MiniAppBackupV1 } from "./backup.ts";
import { createMiniAppBackup } from "./backup-storage.ts";
import { listInstalledMiniApps, type InstalledMiniApp } from "./database.ts";
import {
  HOST_BACKUP_FORMAT,
  HOST_BACKUP_VERSION,
  parseHostBackup,
  type HostBackupRetainedState,
  type HostBackupV1,
} from "./host-backup.ts";
import { isDiagnosticAppId, isPreviewStorageId } from "./namespaces.ts";

const databasePromise = SQLite.openDatabaseAsync("pocket-tools.db");

interface NamespaceRow {
  readonly app_id: string;
}

interface SettingRow {
  readonly name: string;
  readonly value_json: string;
}

interface RecordRow {
  readonly id: string;
  readonly collection_name: string;
  readonly data_json: string;
  readonly created_at: string;
  readonly updated_at: string;
}

interface TimerRow {
  readonly timer_id: string;
  readonly started_at: string;
}

export interface PreparedHostBackupApp {
  readonly backup: MiniAppBackupV1;
  readonly activeInspection: MiniAppInspection;
  readonly lastKnownGoodInspection: MiniAppInspection;
}

export interface PreparedHostBackup {
  readonly backup: HostBackupV1;
  readonly apps: readonly PreparedHostBackupApp[];
}

export async function createHostBackup(): Promise<HostBackupV1> {
  const installed = await listInstalledMiniApps();
  const apps = await Promise.all(installed.map(async (app) => createMiniAppBackup(app.id)));
  const installedIds = new Set(installed.map((app) => app.id));

  const database = await databasePromise;
  const namespaceRows = await database.getAllAsync<NamespaceRow>(
    `SELECT app_id FROM settings
     UNION
     SELECT app_id FROM records
     UNION
     SELECT app_id FROM timers
     ORDER BY app_id ASC`,
  );
  const retainedIds = namespaceRows
    .map((row) => row.app_id)
    .filter(
      (appId) =>
        !installedIds.has(appId) && !isPreviewStorageId(appId) && !isDiagnosticAppId(appId),
    );
  const retained = await Promise.all(
    retainedIds.map(async (appId) => readRetainedState(database, appId)),
  );

  return parseHostBackup({
    format: HOST_BACKUP_FORMAT,
    version: HOST_BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    apps,
    retained,
  });
}

export async function prepareHostBackup(input: unknown): Promise<PreparedHostBackup> {
  const backup = parseHostBackup(input);
  const apps = await Promise.all(
    backup.apps.map(async (appBackup) => {
      const [activeInspection, lastKnownGoodInspection] = await Promise.all([
        inspectMiniApp(appBackup.app.activeSource),
        inspectMiniApp(appBackup.app.lastKnownGoodSource),
      ]);
      validateMiniAppBackupForRestore(appBackup, activeInspection, lastKnownGoodInspection);
      return { backup: appBackup, activeInspection, lastKnownGoodInspection };
    }),
  );
  return { backup, apps };
}

export async function restoreHostBackup(
  prepared: PreparedHostBackup,
): Promise<readonly InstalledMiniApp[]> {
  const backup = parseHostBackup(prepared.backup);
  const preparedById = new Map(prepared.apps.map((entry) => [entry.backup.app.id, entry]));
  if (preparedById.size !== backup.apps.length) {
    throw new Error("HOST_BACKUP_INVALID: Prepared app inspections do not match the backup.");
  }
  for (const appBackup of backup.apps) {
    const preparedApp = preparedById.get(appBackup.app.id);
    if (preparedApp === undefined) {
      throw new Error(
        `HOST_BACKUP_INVALID: Missing prepared inspections for ${appBackup.app.id}.`,
      );
    }
    validateMiniAppBackupForRestore(
      appBackup,
      preparedApp.activeInspection,
      preparedApp.lastKnownGoodInspection,
    );
  }

  const database = await databasePromise;
  try {
    await database.withTransactionAsync(async () => {
      await database.runAsync("DELETE FROM installed_mini_apps");
      await database.runAsync("DELETE FROM settings");
      await database.runAsync("DELETE FROM records");
      await database.runAsync("DELETE FROM timers");

      for (const appBackup of backup.apps) {
        await insertInstalledApp(database, appBackup);
        await insertState(database, appBackup.app.id, appBackup);
      }
      for (const retained of backup.retained) {
        await insertState(database, retained.appId, retained);
      }
    });
  } catch (cause) {
    if (
      cause instanceof Error &&
      /^(?:HOST_BACKUP_INVALID|BACKUP_INVALID):/.test(cause.message)
    ) {
      throw cause;
    }
    throw new Error(
      "HOST_BACKUP_RESTORE_FAILED: SQLite could not replace Pocket Tools state atomically.",
      { cause },
    );
  }

  const restored = await listInstalledMiniApps();
  if (restored.length !== backup.apps.length) {
    throw new Error(
      "HOST_BACKUP_RESTORE_FAILED: The restored mini-app library could not be reloaded.",
    );
  }
  return restored;
}

async function readRetainedState(
  database: SQLite.SQLiteDatabase,
  appId: string,
): Promise<HostBackupRetainedState> {
  const [settingRows, recordRows, timerRows] = await Promise.all([
    database.getAllAsync<SettingRow>(
      "SELECT name, value_json FROM settings WHERE app_id = ? ORDER BY name ASC",
      appId,
    ),
    database.getAllAsync<RecordRow>(
      `SELECT id, collection_name, data_json, created_at, updated_at
       FROM records
       WHERE app_id = ?
       ORDER BY collection_name ASC, created_at ASC, id ASC`,
      appId,
    ),
    database.getAllAsync<TimerRow>(
      "SELECT timer_id, started_at FROM timers WHERE app_id = ? ORDER BY timer_id ASC",
      appId,
    ),
  ]);
  return {
    appId,
    settings: settingRows.map((row) => ({
      name: row.name,
      value: parseStoredValue(row.value_json, `${appId}.settings.${row.name}`),
    })),
    records: recordRows.map((row) => ({
      id: row.id,
      collection: row.collection_name,
      data: parseStoredObject(row.data_json, `${appId}.records.${row.id}`),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
    timers: timerRows.map((row) => ({ id: row.timer_id, startedAt: row.started_at })),
  };
}

async function insertInstalledApp(
  database: SQLite.SQLiteDatabase,
  backup: MiniAppBackupV1,
): Promise<void> {
  await database.runAsync(
    `INSERT INTO installed_mini_apps (
       app_id, name, description, icon, active_source,
       last_known_good_source, installed_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    backup.app.id,
    backup.app.name,
    backup.app.description ?? null,
    backup.app.icon ?? null,
    backup.app.activeSource,
    backup.app.lastKnownGoodSource,
    backup.app.installedAt,
    backup.app.updatedAt,
  );
}

async function insertState(
  database: SQLite.SQLiteDatabase,
  appId: string,
  state: Pick<MiniAppBackupV1, "settings" | "records" | "timers">,
): Promise<void> {
  for (const setting of state.settings) {
    await database.runAsync(
      "INSERT INTO settings (app_id, name, value_json) VALUES (?, ?, ?)",
      appId,
      setting.name,
      JSON.stringify(setting.value),
    );
  }
  for (const record of state.records) {
    await database.runAsync(
      `INSERT INTO records (
         id, app_id, collection_name, data_json, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?)`,
      record.id,
      appId,
      record.collection,
      JSON.stringify(record.data),
      record.createdAt,
      record.updatedAt,
    );
  }
  for (const timer of state.timers) {
    await database.runAsync(
      "INSERT INTO timers (app_id, timer_id, started_at) VALUES (?, ?, ?)",
      appId,
      timer.id,
      timer.startedAt,
    );
  }
}

function parseStoredValue(json: string, path: string): SerializableValue {
  try {
    return JSON.parse(json) as SerializableValue;
  } catch (cause) {
    throw new Error(`HOST_BACKUP_INVALID: Stored ${path} is not valid JSON.`, { cause });
  }
}

function parseStoredObject(
  json: string,
  path: string,
): Readonly<Record<string, SerializableValue>> {
  const value = parseStoredValue(json, path);
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`HOST_BACKUP_INVALID: Stored ${path} must be an object.`);
  }
  return value as Readonly<Record<string, SerializableValue>>;
}
