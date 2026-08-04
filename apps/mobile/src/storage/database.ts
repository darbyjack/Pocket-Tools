import * as SQLite from "expo-sqlite";

import type {
  MiniAppInspection,
  RuntimeOperation,
  RuntimeSnapshot,
  SerializableValue,
  StoredRecord,
  TimerSnapshot,
} from "../model";
import { assertRecordId, assertRecordInput, assertSettingValue } from "../runtime/sdk-validation";
import { isPreviewStorageId, PREVIEW_STORAGE_PREFIX } from "./namespaces";

const databasePromise = SQLite.openDatabaseAsync("pocket-tools.db");
const BUNDLED_SEED_KEY = "bundled-mini-apps-v1";

interface SettingRow {
  readonly name: string;
  readonly value_json: string;
}

interface RecordRow {
  readonly id: string;
  readonly data_json: string;
  readonly created_at: string;
  readonly updated_at: string;
}

interface TimerRow {
  readonly timer_id: string;
  readonly started_at: string;
}

interface InstalledMiniAppRow {
  readonly app_id: string;
  readonly name: string;
  readonly description: string | null;
  readonly icon: string | null;
  readonly active_source: string;
  readonly last_known_good_source: string;
  readonly installed_at: string;
  readonly updated_at: string;
}

export interface InstalledMiniApp {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly icon?: string;
  readonly activeSource: string;
  readonly lastKnownGoodSource: string;
  readonly installedAt: string;
  readonly updatedAt: string;
}

export interface BundledMiniAppSeed {
  readonly inspection: MiniAppInspection;
  readonly source: string;
}

export async function initializeDatabase(): Promise<void> {
  const database = await databasePromise;
  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS settings (
      app_id TEXT NOT NULL,
      name TEXT NOT NULL,
      value_json TEXT NOT NULL,
      PRIMARY KEY (app_id, name)
    );

    CREATE TABLE IF NOT EXISTS records (
      id TEXT PRIMARY KEY NOT NULL,
      app_id TEXT NOT NULL,
      collection_name TEXT NOT NULL,
      data_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS records_app_collection
      ON records (app_id, collection_name, created_at DESC);

    CREATE TABLE IF NOT EXISTS timers (
      app_id TEXT NOT NULL,
      timer_id TEXT NOT NULL,
      started_at TEXT NOT NULL,
      PRIMARY KEY (app_id, timer_id)
    );

    CREATE TABLE IF NOT EXISTS installed_mini_apps (
      app_id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      icon TEXT,
      active_source TEXT NOT NULL,
      last_known_good_source TEXT NOT NULL,
      installed_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_metadata (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
  `);

  await database.withTransactionAsync(async () => {
    await database.runAsync(
      "DELETE FROM settings WHERE app_id GLOB ?",
      `${PREVIEW_STORAGE_PREFIX}*`,
    );
    await database.runAsync(
      "DELETE FROM records WHERE app_id GLOB ?",
      `${PREVIEW_STORAGE_PREFIX}*`,
    );
    await database.runAsync("DELETE FROM timers WHERE app_id GLOB ?", `${PREVIEW_STORAGE_PREFIX}*`);
  });
}

export async function seedBundledMiniAppsOnce(seeds: readonly BundledMiniAppSeed[]): Promise<void> {
  const database = await databasePromise;
  await database.withTransactionAsync(async () => {
    const completed = await database.getFirstAsync<{ readonly value: string }>(
      "SELECT value FROM app_metadata WHERE key = ?",
      BUNDLED_SEED_KEY,
    );
    if (completed !== null) return;

    const timestamp = new Date().toISOString();
    for (const seed of seeds) {
      await database.runAsync(
        `INSERT OR IGNORE INTO installed_mini_apps (
           app_id, name, description, icon, active_source,
           last_known_good_source, installed_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        seed.inspection.manifest.id,
        seed.inspection.manifest.name,
        seed.inspection.manifest.description ?? null,
        seed.inspection.manifest.icon ?? null,
        seed.source,
        seed.source,
        timestamp,
        timestamp,
      );
    }

    await database.runAsync(
      "INSERT INTO app_metadata (key, value) VALUES (?, ?)",
      BUNDLED_SEED_KEY,
      timestamp,
    );
  });
}

export async function listInstalledMiniApps(): Promise<readonly InstalledMiniApp[]> {
  const database = await databasePromise;
  const rows = await database.getAllAsync<InstalledMiniAppRow>(
    `SELECT app_id, name, description, icon, active_source,
            last_known_good_source, installed_at, updated_at
     FROM installed_mini_apps
     ORDER BY name COLLATE NOCASE ASC, installed_at ASC`,
  );
  return rows.map(mapInstalledMiniApp);
}

export async function getInstalledMiniApp(appId: string): Promise<InstalledMiniApp | null> {
  const database = await databasePromise;
  const row = await database.getFirstAsync<InstalledMiniAppRow>(
    `SELECT app_id, name, description, icon, active_source,
            last_known_good_source, installed_at, updated_at
     FROM installed_mini_apps
     WHERE app_id = ?`,
    appId,
  );
  return row === null ? null : mapInstalledMiniApp(row);
}

export async function installMiniApp(
  inspection: MiniAppInspection,
  source: string,
): Promise<InstalledMiniApp> {
  const appId = inspection.manifest.id;
  if ((await getInstalledMiniApp(appId)) !== null) {
    throw new Error(`INSTALLATION_FAILED: A mini app with ID ${appId} is already installed.`);
  }

  const database = await databasePromise;
  const timestamp = new Date().toISOString();
  try {
    await database.runAsync(
      `INSERT INTO installed_mini_apps (
         app_id, name, description, icon, active_source,
         last_known_good_source, installed_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      appId,
      inspection.manifest.name,
      inspection.manifest.description ?? null,
      inspection.manifest.icon ?? null,
      source,
      source,
      timestamp,
      timestamp,
    );
  } catch (cause) {
    if ((await getInstalledMiniApp(appId)) !== null) {
      throw new Error(`INSTALLATION_FAILED: A mini app with ID ${appId} is already installed.`, {
        cause,
      });
    }
    throw new Error("INSTALLATION_FAILED: SQLite could not store the mini app.", {
      cause,
    });
  }

  const installed = await getInstalledMiniApp(appId);
  if (installed === null) {
    throw new Error("INSTALLATION_FAILED: The installed mini app could not be reloaded.");
  }
  return installed;
}

export async function updateInstalledMiniApp(
  appId: string,
  inspection: MiniAppInspection,
  source: string,
): Promise<InstalledMiniApp> {
  if (inspection.manifest.id !== appId) {
    throw new Error(
      `INSTALLATION_FAILED: An update cannot change manifest.id from ${appId} to ${inspection.manifest.id}. Duplicate the script to create a new app instead.`,
    );
  }

  const current = await getInstalledMiniApp(appId);
  if (current === null) {
    throw new Error(`INSTALLATION_FAILED: ${appId} is not installed.`);
  }

  const database = await databasePromise;
  const result = await database.runAsync(
    `UPDATE installed_mini_apps
     SET name = ?, description = ?, icon = ?, active_source = ?,
         last_known_good_source = ?, updated_at = ?
     WHERE app_id = ?`,
    inspection.manifest.name,
    inspection.manifest.description ?? null,
    inspection.manifest.icon ?? null,
    source,
    current.activeSource,
    new Date().toISOString(),
    appId,
  );
  if (result.changes !== 1) {
    throw new Error(`INSTALLATION_FAILED: ${appId} is not installed.`);
  }

  const installed = await getInstalledMiniApp(appId);
  if (installed === null) {
    throw new Error("INSTALLATION_FAILED: The updated mini app could not be reloaded.");
  }
  return installed;
}

export async function rollbackInstalledMiniApp(
  appId: string,
  inspection: MiniAppInspection,
): Promise<InstalledMiniApp> {
  if (inspection.manifest.id !== appId) {
    throw new Error("INSTALLATION_FAILED: The rollback source has a different manifest ID.");
  }

  const current = await getInstalledMiniApp(appId);
  if (current === null) {
    throw new Error(`INSTALLATION_FAILED: ${appId} is not installed.`);
  }

  const database = await databasePromise;
  const result = await database.runAsync(
    `UPDATE installed_mini_apps
     SET name = ?, description = ?, icon = ?,
         active_source = ?, last_known_good_source = ?, updated_at = ?
     WHERE app_id = ?`,
    inspection.manifest.name,
    inspection.manifest.description ?? null,
    inspection.manifest.icon ?? null,
    current.lastKnownGoodSource,
    current.activeSource,
    new Date().toISOString(),
    appId,
  );
  if (result.changes !== 1) {
    throw new Error(`INSTALLATION_FAILED: ${appId} is not installed.`);
  }

  const installed = await getInstalledMiniApp(appId);
  if (installed === null) {
    throw new Error("INSTALLATION_FAILED: The rolled-back mini app could not be reloaded.");
  }
  return installed;
}

export async function deleteInstalledMiniApp(appId: string, deleteData: boolean): Promise<void> {
  const database = await databasePromise;
  await database.withTransactionAsync(async () => {
    await database.runAsync("DELETE FROM installed_mini_apps WHERE app_id = ?", appId);
    if (deleteData) await clearAppDataInTransaction(database, appId);
  });
}

export async function preparePreviewStorage(
  sourceStorageId: string | null,
  previewStorageId: string,
): Promise<void> {
  if (!isPreviewStorageId(previewStorageId)) {
    throw new Error("INSTALLATION_FAILED: Preview storage must use the reserved host namespace.");
  }

  const database = await databasePromise;
  await database.withTransactionAsync(async () => {
    await clearAppDataInTransaction(database, previewStorageId);
    if (sourceStorageId === null) return;

    await database.runAsync(
      `INSERT INTO settings (app_id, name, value_json)
       SELECT ?, name, value_json FROM settings WHERE app_id = ?`,
      previewStorageId,
      sourceStorageId,
    );
    await database.runAsync(
      `INSERT INTO timers (app_id, timer_id, started_at)
       SELECT ?, timer_id, started_at FROM timers WHERE app_id = ?`,
      previewStorageId,
      sourceStorageId,
    );
    await database.runAsync(
      `INSERT INTO records (
         id, app_id, collection_name, data_json, created_at, updated_at
       )
       SELECT lower(hex(randomblob(16))), ?, collection_name, data_json,
              created_at, updated_at
       FROM records WHERE app_id = ?`,
      previewStorageId,
      sourceStorageId,
    );
  });
}

export async function clearAppData(storageId: string): Promise<void> {
  const database = await databasePromise;
  await database.withTransactionAsync(async () => {
    await clearAppDataInTransaction(database, storageId);
  });
}

export async function ensureSettingDefaults(
  inspection: MiniAppInspection,
  storageId = inspection.manifest.id,
): Promise<void> {
  const database = await databasePromise;
  await database.withTransactionAsync(async () => {
    for (const [name, definition] of Object.entries(inspection.settings)) {
      assertSettingValue(definition, definition.default, `settings.${name}.default`);
      await database.runAsync(
        `INSERT OR IGNORE INTO settings (app_id, name, value_json)
         VALUES (?, ?, ?)`,
        storageId,
        name,
        JSON.stringify(definition.default),
      );
    }
  });
}

export async function setSetting(
  inspection: MiniAppInspection,
  storageId: string,
  name: string,
  value: SerializableValue,
): Promise<void> {
  const definition = inspection.settings[name];
  if (definition === undefined) {
    throw new Error(`VALIDATION_FAILED: settings.${name}: Unknown setting.`);
  }
  assertSettingValue(definition, value, `settings.${name}`);

  const database = await databasePromise;
  await database.runAsync(
    `INSERT INTO settings (app_id, name, value_json)
     VALUES (?, ?, ?)
     ON CONFLICT(app_id, name) DO UPDATE SET value_json = excluded.value_json`,
    storageId,
    name,
    JSON.stringify(value),
  );
}

export async function loadRuntimeSnapshot(
  inspection: MiniAppInspection,
  storageId: string,
  mode: RuntimeSnapshot["mode"],
  options: { readonly action?: string; readonly screen?: string } = {},
): Promise<RuntimeSnapshot> {
  const database = await databasePromise;
  const now = new Date();

  const settingRows = await database.getAllAsync<SettingRow>(
    "SELECT name, value_json FROM settings WHERE app_id = ?",
    storageId,
  );
  const settings: Record<string, SerializableValue> = {};
  for (const row of settingRows) {
    const definition = inspection.settings[row.name];
    if (definition === undefined) continue;
    const value = JSON.parse(row.value_json) as SerializableValue;
    assertSettingValue(definition, value, `settings.${row.name}`);
    settings[row.name] = value;
  }

  const records: Record<string, StoredRecord[]> = {};
  for (const [collectionName, definition] of Object.entries(inspection.collections)) {
    const rows = await database.getAllAsync<RecordRow>(
      `SELECT id, data_json, created_at, updated_at
       FROM records
       WHERE app_id = ? AND collection_name = ?
       ORDER BY created_at DESC`,
      storageId,
      collectionName,
    );
    records[collectionName] = rows.map((row) => {
      const data = JSON.parse(row.data_json) as Record<string, SerializableValue>;
      assertRecordInput(definition, data, `records.${collectionName}.${row.id}`);
      return {
        ...data,
        id: row.id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    });
  }

  const timerRows = await database.getAllAsync<TimerRow>(
    "SELECT timer_id, started_at FROM timers WHERE app_id = ?",
    storageId,
  );
  const timers: Record<string, TimerSnapshot> = {};
  for (const row of timerRows) {
    const startedAtMilliseconds = Date.parse(row.started_at);
    timers[row.timer_id] = {
      id: row.timer_id,
      startedAt: row.started_at,
      elapsedSeconds: Number.isFinite(startedAtMilliseconds)
        ? Math.max(0, (now.getTime() - startedAtMilliseconds) / 1_000)
        : 0,
    };
  }

  return {
    mode,
    ...(mode === "render" ? { screen: options.screen ?? "home" } : {}),
    ...(options.action === undefined ? {} : { action: options.action }),
    now: now.toISOString(),
    settings,
    records,
    timers,
  };
}

export async function applyRuntimeOperations(
  inspection: MiniAppInspection,
  storageId: string,
  operations: readonly RuntimeOperation[],
): Promise<void> {
  const database = await databasePromise;

  await database.withTransactionAsync(async () => {
    for (const [index, operation] of operations.entries()) {
      switch (operation.type) {
        case "insert": {
          const definition = requireCollection(inspection, operation.collection, index);
          assertRecordInput(definition, operation.record, `operations[${index}].record`);
          const timestamp = new Date().toISOString();
          await database.runAsync(
            `INSERT INTO records (
               id, app_id, collection_name, data_json, created_at, updated_at
             ) VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?)`,
            storageId,
            operation.collection,
            JSON.stringify(operation.record),
            timestamp,
            timestamp,
          );
          break;
        }
        case "update": {
          const definition = requireCollection(inspection, operation.collection, index);
          assertRecordId(operation.id, `operations[${index}].id`);
          assertRecordInput(definition, operation.changes, `operations[${index}].changes`, true);
          const existing = await database.getFirstAsync<{ readonly data_json: string }>(
            `SELECT data_json FROM records
             WHERE id = ? AND app_id = ? AND collection_name = ?`,
            operation.id,
            storageId,
            operation.collection,
          );
          if (existing === null) {
            throw new Error(`RECORD_NOT_FOUND: ${operation.collection}.${operation.id}`);
          }
          const merged = {
            ...(JSON.parse(existing.data_json) as Record<string, SerializableValue>),
            ...operation.changes,
          };
          assertRecordInput(definition, merged, `operations[${index}].record`);
          const result = await database.runAsync(
            `UPDATE records SET data_json = ?, updated_at = ?
             WHERE id = ? AND app_id = ? AND collection_name = ?`,
            JSON.stringify(merged),
            new Date().toISOString(),
            operation.id,
            storageId,
            operation.collection,
          );
          if (result.changes !== 1) {
            throw new Error(`RECORD_NOT_FOUND: ${operation.collection}.${operation.id}`);
          }
          break;
        }
        case "remove": {
          requireCollection(inspection, operation.collection, index);
          assertRecordId(operation.id, `operations[${index}].id`);
          const result = await database.runAsync(
            "DELETE FROM records WHERE id = ? AND app_id = ? AND collection_name = ?",
            operation.id,
            storageId,
            operation.collection,
          );
          if (result.changes !== 1) {
            throw new Error(`RECORD_NOT_FOUND: ${operation.collection}.${operation.id}`);
          }
          break;
        }
        case "setting-set": {
          const definition = requireSdk12Setting(inspection, operation.setting, index);
          assertSettingValue(definition, operation.value, `operations[${index}].value`);
          await writeSettingInTransaction(database, storageId, operation.setting, operation.value);
          break;
        }
        case "setting-reset": {
          const definition = requireSdk12Setting(inspection, operation.setting, index);
          assertSettingValue(definition, definition.default, `operations[${index}].default`);
          await writeSettingInTransaction(
            database,
            storageId,
            operation.setting,
            definition.default,
          );
          break;
        }
        case "timer-start":
          await database.runAsync(
            `INSERT INTO timers (app_id, timer_id, started_at)
             VALUES (?, ?, ?)`,
            storageId,
            operation.timerId,
            operation.startedAt,
          );
          break;
        case "timer-stop": {
          const result = await database.runAsync(
            "DELETE FROM timers WHERE app_id = ? AND timer_id = ?",
            storageId,
            operation.timerId,
          );
          if (result.changes !== 1) {
            throw new Error(`TIMER_NOT_FOUND: ${operation.timerId}`);
          }
          break;
        }
        default:
          throw new Error(`INVALID_OPERATION: operations[${index}] has an unsupported type.`);
      }
    }
  });
}

async function clearAppDataInTransaction(
  database: SQLite.SQLiteDatabase,
  storageId: string,
): Promise<void> {
  await database.runAsync("DELETE FROM settings WHERE app_id = ?", storageId);
  await database.runAsync("DELETE FROM records WHERE app_id = ?", storageId);
  await database.runAsync("DELETE FROM timers WHERE app_id = ?", storageId);
}

async function writeSettingInTransaction(
  database: SQLite.SQLiteDatabase,
  storageId: string,
  name: string,
  value: SerializableValue,
): Promise<void> {
  await database.runAsync(
    `INSERT INTO settings (app_id, name, value_json)
     VALUES (?, ?, ?)
     ON CONFLICT(app_id, name) DO UPDATE SET value_json = excluded.value_json`,
    storageId,
    name,
    JSON.stringify(value),
  );
}

function mapInstalledMiniApp(row: InstalledMiniAppRow): InstalledMiniApp {
  return {
    id: row.app_id,
    name: row.name,
    ...(row.description === null ? {} : { description: row.description }),
    ...(row.icon === null ? {} : { icon: row.icon }),
    activeSource: row.active_source,
    lastKnownGoodSource: row.last_known_good_source,
    installedAt: row.installed_at,
    updatedAt: row.updated_at,
  };
}

function requireCollection(inspection: MiniAppInspection, name: string, operationIndex: number) {
  const definition = inspection.collections[name];
  if (definition === undefined) {
    throw new Error(`UNKNOWN_COLLECTION: operations[${operationIndex}].collection: ${name}`);
  }
  return definition;
}

function requireSdk12Setting(inspection: MiniAppInspection, name: string, operationIndex: number) {
  if ((inspection.manifest.sdkVersion as string) !== "1.2") {
    throw new Error(
      `UNSUPPORTED_SDK_VERSION: operations[${operationIndex}] setting writes require SDK 1.2.`,
    );
  }
  const definition = inspection.settings[name];
  if (definition === undefined) {
    throw new Error(
      `VALIDATION_FAILED: operations[${operationIndex}].setting: Unknown setting ${name}.`,
    );
  }
  return definition;
}
