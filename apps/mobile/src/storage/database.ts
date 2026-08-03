import * as SQLite from "expo-sqlite";

import type {
  MiniAppInspection,
  RuntimeOperation,
  RuntimeSnapshot,
  SerializableValue,
  StoredRecord,
  TimerSnapshot,
} from "../model";
import {
  assertRecordId,
  assertRecordInput,
  assertSettingValue,
} from "../runtime/sdk-validation";

const databasePromise = SQLite.openDatabaseAsync("pocket-tools.db");

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
  `);
}

export async function ensureSettingDefaults(
  inspection: MiniAppInspection,
): Promise<void> {
  const database = await databasePromise;
  await database.withTransactionAsync(async () => {
    for (const [name, definition] of Object.entries(inspection.settings)) {
      assertSettingValue(definition, definition.default, `settings.${name}.default`);
      await database.runAsync(
        `INSERT OR IGNORE INTO settings (app_id, name, value_json)
         VALUES (?, ?, ?)`,
        inspection.manifest.id,
        name,
        JSON.stringify(definition.default),
      );
    }
  });
}

export async function setSetting(
  inspection: MiniAppInspection,
  name: string,
  value: SerializableValue,
): Promise<void> {
  const definition = inspection.settings[name];
  if (definition === undefined) throw new Error(`VALIDATION_FAILED: settings.${name}: Unknown setting.`);
  assertSettingValue(definition, value, `settings.${name}`);

  const database = await databasePromise;
  await database.runAsync(
    `INSERT INTO settings (app_id, name, value_json)
     VALUES (?, ?, ?)
     ON CONFLICT(app_id, name) DO UPDATE SET value_json = excluded.value_json`,
    inspection.manifest.id,
    name,
    JSON.stringify(value),
  );
}

export async function loadRuntimeSnapshot(
  inspection: MiniAppInspection,
  mode: RuntimeSnapshot["mode"],
  options: { readonly action?: string; readonly screen?: string } = {},
): Promise<RuntimeSnapshot> {
  const database = await databasePromise;
  const appId = inspection.manifest.id;
  const now = new Date();

  const settingRows = await database.getAllAsync<SettingRow>(
    "SELECT name, value_json FROM settings WHERE app_id = ?",
    appId,
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
      appId,
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
    appId,
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
  operations: readonly RuntimeOperation[],
): Promise<void> {
  const database = await databasePromise;
  const appId = inspection.manifest.id;

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
            appId,
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
            appId,
            operation.collection,
          );
          if (existing === null) throw new Error(`RECORD_NOT_FOUND: ${operation.collection}.${operation.id}`);
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
            appId,
            operation.collection,
          );
          if (result.changes !== 1) throw new Error(`RECORD_NOT_FOUND: ${operation.collection}.${operation.id}`);
          break;
        }
        case "remove": {
          requireCollection(inspection, operation.collection, index);
          assertRecordId(operation.id, `operations[${index}].id`);
          const result = await database.runAsync(
            "DELETE FROM records WHERE id = ? AND app_id = ? AND collection_name = ?",
            operation.id,
            appId,
            operation.collection,
          );
          if (result.changes !== 1) throw new Error(`RECORD_NOT_FOUND: ${operation.collection}.${operation.id}`);
          break;
        }
        case "timer-start":
          await database.runAsync(
            `INSERT INTO timers (app_id, timer_id, started_at)
             VALUES (?, ?, ?)`,
            appId,
            operation.timerId,
            operation.startedAt,
          );
          break;
        case "timer-stop": {
          const result = await database.runAsync(
            "DELETE FROM timers WHERE app_id = ? AND timer_id = ?",
            appId,
            operation.timerId,
          );
          if (result.changes !== 1) throw new Error(`TIMER_NOT_FOUND: ${operation.timerId}`);
          break;
        }
        default:
          throw new Error(`INVALID_OPERATION: operations[${index}] has an unsupported type.`);
      }
    }
  });
}

function requireCollection(
  inspection: MiniAppInspection,
  name: string,
  operationIndex: number,
) {
  const definition = inspection.collections[name];
  if (definition === undefined) {
    throw new Error(`UNKNOWN_COLLECTION: operations[${operationIndex}].collection: ${name}`);
  }
  return definition;
}
