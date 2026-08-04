import * as SQLite from "expo-sqlite";

import type {
  MiniAppInspection,
  RuntimeOperation,
  SerializableValue,
} from "../model.ts";
import { assertRecordId, assertRecordInput, assertSettingValue } from "../runtime/sdk-validation.ts";
import {
  applyPreparedNotificationOperation,
  ensureNotificationRegistrySchema,
  prepareNotificationOperations,
} from "./notification-registry.ts";

const databasePromise = SQLite.openDatabaseAsync("pocket-tools.db");
const SDK_1_2_OPERATION_LIMIT = 256;

export interface Sdk12ActionStorageOptions {
  readonly actionNow: string;
  readonly exactAlarmAccess?: boolean;
}

export async function applySdk12RuntimeOperations(
  inspection: MiniAppInspection,
  storageId: string,
  operations: readonly RuntimeOperation[],
  options: Sdk12ActionStorageOptions,
): Promise<void> {
  if ((inspection.manifest.sdkVersion as string) !== "1.2") {
    throw new Error("UNSUPPORTED_SDK_VERSION: SDK 1.2 action storage requires SDK 1.2.");
  }
  if (operations.length > SDK_1_2_OPERATION_LIMIT) {
    throw new Error(
      `ACTION_LIMIT_EXCEEDED: An SDK 1.2 action may record at most ${SDK_1_2_OPERATION_LIMIT} operations.`,
    );
  }

  const database = await databasePromise;
  await ensureNotificationRegistrySchema(database);
  const notificationOperations = await prepareNotificationOperations(
    database,
    inspection,
    storageId,
    operations,
    {
      now: options.actionNow,
      exactAlarmAccess: options.exactAlarmAccess === true,
    },
  );

  await database.withTransactionAsync(async () => {
    for (const [index, operation] of operations.entries()) {
      const preparedNotification = notificationOperations.get(index);
      if (preparedNotification !== undefined) {
        await applyPreparedNotificationOperation(
          database,
          storageId,
          preparedNotification,
          options.actionNow,
        );
        continue;
      }

      switch (operation.type) {
        case "insert": {
          const definition = requireCollection(inspection, operation.collection, index);
          assertRecordInput(definition, operation.record, `operations[${index}].record`);
          await database.runAsync(
            `INSERT INTO records (
               id, app_id, collection_name, data_json, created_at, updated_at
             ) VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?)`,
            storageId,
            operation.collection,
            JSON.stringify(operation.record),
            options.actionNow,
            options.actionNow,
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
            options.actionNow,
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
          const definition = requireSetting(inspection, operation.setting, index);
          assertSettingValue(definition, operation.value, `operations[${index}].value`);
          await writeSetting(database, storageId, operation.setting, operation.value);
          break;
        }
        case "setting-reset": {
          const definition = requireSetting(inspection, operation.setting, index);
          assertSettingValue(definition, definition.default, `operations[${index}].default`);
          await writeSetting(database, storageId, operation.setting, definition.default);
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
        case "notification-schedule":
        case "notification-cancel":
        case "notification-cancel-all":
          throw new Error(
            `INVALID_OPERATION: operations[${index}] was not prepared as a notification operation.`,
          );
        default:
          throw new Error(`INVALID_OPERATION: operations[${index}] has an unsupported type.`);
      }
    }
  });
}

async function writeSetting(
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

function requireCollection(inspection: MiniAppInspection, name: string, operationIndex: number) {
  const definition = inspection.collections[name];
  if (definition === undefined) {
    throw new Error(`UNKNOWN_COLLECTION: operations[${operationIndex}].collection: ${name}`);
  }
  return definition;
}

function requireSetting(inspection: MiniAppInspection, name: string, operationIndex: number) {
  const definition = inspection.settings[name];
  if (definition === undefined) {
    throw new Error(
      `VALIDATION_FAILED: operations[${operationIndex}].setting: Unknown setting ${name}.`,
    );
  }
  return definition;
}
