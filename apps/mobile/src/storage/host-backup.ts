import type { SerializableValue } from "../model.ts";
import {
  parseMiniAppBackup,
  type MiniAppBackupRecord,
  type MiniAppBackupSetting,
  type MiniAppBackupTimer,
  type MiniAppBackupV1,
} from "./backup.ts";
import { isDiagnosticAppId, isPreviewStorageId } from "./namespaces.ts";

export const HOST_BACKUP_FORMAT = "pocket-tools-host";
export const HOST_BACKUP_VERSION = 1;

export interface HostBackupRetainedState {
  readonly appId: string;
  readonly settings: readonly MiniAppBackupSetting[];
  readonly records: readonly MiniAppBackupRecord[];
  readonly timers: readonly MiniAppBackupTimer[];
}

export interface HostBackupV1 {
  readonly format: typeof HOST_BACKUP_FORMAT;
  readonly version: typeof HOST_BACKUP_VERSION;
  readonly exportedAt: string;
  readonly apps: readonly MiniAppBackupV1[];
  readonly retained: readonly HostBackupRetainedState[];
}

export function parseHostBackup(input: unknown): HostBackupV1 {
  let value: unknown = input;
  if (typeof input === "string") {
    try {
      value = JSON.parse(input) as unknown;
    } catch (cause) {
      throw hostBackupError("Backup is not valid JSON.", cause);
    }
  }

  const root = requireObject(value, "backup");
  assertExactKeys(root, ["format", "version", "exportedAt", "apps", "retained"], "backup");
  if (root.format !== HOST_BACKUP_FORMAT) {
    throw hostBackupError(`backup.format must be ${HOST_BACKUP_FORMAT}.`);
  }
  if (root.version !== HOST_BACKUP_VERSION) {
    throw hostBackupError(`backup.version must be ${HOST_BACKUP_VERSION}.`);
  }

  const apps = requireArray(root.apps, "backup.apps").map((entry, index) => {
    try {
      return parseMiniAppBackup(entry);
    } catch (cause) {
      throw hostBackupError(
        `backup.apps[${index}] is not a valid single-app backup: ${errorMessage(cause)}`,
        cause,
      );
    }
  });
  const retained = requireArray(root.retained, "backup.retained").map((entry, index) =>
    parseRetainedState(entry, index),
  );

  assertUnique(apps, (entry) => entry.app.id, "backup.apps", "app ID");
  assertUnique(retained, (entry) => entry.appId, "backup.retained", "app ID");

  const installedIds = new Set(apps.map((entry) => entry.app.id));
  for (const app of apps) assertUserNamespace(app.app.id, `backup.apps.${app.app.id}`);
  for (const state of retained) {
    assertUserNamespace(state.appId, `backup.retained.${state.appId}`);
    if (installedIds.has(state.appId)) {
      throw hostBackupError(
        `backup.retained contains ${state.appId}, which is already present in backup.apps.`,
      );
    }
  }

  const recordIds = new Set<string>();
  for (const app of apps) collectRecordIds(app.records, `backup.apps.${app.app.id}`, recordIds);
  for (const state of retained) {
    collectRecordIds(state.records, `backup.retained.${state.appId}`, recordIds);
  }

  return {
    format: HOST_BACKUP_FORMAT,
    version: HOST_BACKUP_VERSION,
    exportedAt: requireIsoTimestamp(root.exportedAt, "backup.exportedAt"),
    apps,
    retained,
  };
}

export function stringifyHostBackup(backup: HostBackupV1): string {
  return `${JSON.stringify(parseHostBackup(backup), null, 2)}\n`;
}

function parseRetainedState(value: unknown, index: number): HostBackupRetainedState {
  const path = `backup.retained[${index}]`;
  const state = requireObject(value, path);
  assertExactKeys(state, ["appId", "settings", "records", "timers"], path);
  const settings = requireArray(state.settings, `${path}.settings`).map((entry, settingIndex) =>
    parseSetting(entry, `${path}.settings[${settingIndex}]`),
  );
  const records = requireArray(state.records, `${path}.records`).map((entry, recordIndex) =>
    parseRecord(entry, `${path}.records[${recordIndex}]`),
  );
  const timers = requireArray(state.timers, `${path}.timers`).map((entry, timerIndex) =>
    parseTimer(entry, `${path}.timers[${timerIndex}]`),
  );
  assertUnique(settings, (entry) => entry.name, `${path}.settings`, "name");
  assertUnique(records, (entry) => entry.id, `${path}.records`, "record ID");
  assertUnique(timers, (entry) => entry.id, `${path}.timers`, "timer ID");
  return {
    appId: requireAppId(state.appId, `${path}.appId`),
    settings,
    records,
    timers,
  };
}

function parseSetting(value: unknown, path: string): MiniAppBackupSetting {
  const setting = requireObject(value, path);
  assertExactKeys(setting, ["name", "value"], path);
  assertSerializableValue(setting.value, `${path}.value`);
  return {
    name: requireMemberName(setting.name, `${path}.name`),
    value: setting.value as SerializableValue,
  };
}

function parseRecord(value: unknown, path: string): MiniAppBackupRecord {
  const record = requireObject(value, path);
  assertExactKeys(record, ["id", "collection", "data", "createdAt", "updatedAt"], path);
  const data = requireObject(record.data, `${path}.data`);
  assertSerializableValue(data, `${path}.data`);
  return {
    id: requireRecordId(record.id, `${path}.id`),
    collection: requireMemberName(record.collection, `${path}.collection`),
    data: data as Readonly<Record<string, SerializableValue>>,
    createdAt: requireIsoTimestamp(record.createdAt, `${path}.createdAt`),
    updatedAt: requireIsoTimestamp(record.updatedAt, `${path}.updatedAt`),
  };
}

function parseTimer(value: unknown, path: string): MiniAppBackupTimer {
  const timer = requireObject(value, path);
  assertExactKeys(timer, ["id", "startedAt"], path);
  return {
    id: requireMemberName(timer.id, `${path}.id`),
    startedAt: requireIsoTimestamp(timer.startedAt, `${path}.startedAt`),
  };
}

function collectRecordIds(
  records: readonly MiniAppBackupRecord[],
  path: string,
  seen: Set<string>,
): void {
  for (const record of records) {
    if (seen.has(record.id)) {
      throw hostBackupError(`${path} reuses global record ID ${record.id}.`);
    }
    seen.add(record.id);
  }
}

function assertUserNamespace(appId: string, path: string): void {
  if (isPreviewStorageId(appId) || isDiagnosticAppId(appId)) {
    throw hostBackupError(`${path} uses an internal host namespace.`);
  }
}

function requireObject(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw hostBackupError(`${path} must be an object.`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw hostBackupError(`${path} must be a plain object.`);
  }
  return value as Record<string, unknown>;
}

function requireArray(value: unknown, path: string): readonly unknown[] {
  if (!Array.isArray(value)) throw hostBackupError(`${path} must be an array.`);
  return value;
}

function requireNonEmptyString(value: unknown, path: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw hostBackupError(`${path} must be a non-empty string.`);
  }
  return value;
}

function requireAppId(value: unknown, path: string): string {
  const appId = requireNonEmptyString(value, path);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(appId)) {
    throw hostBackupError(`${path} must use lowercase kebab-case.`);
  }
  return appId;
}

function requireMemberName(value: unknown, path: string): string {
  const name = requireNonEmptyString(value, path);
  if (!/^[a-z][A-Za-z0-9]*$/.test(name)) {
    throw hostBackupError(`${path} must use lower camelCase.`);
  }
  return name;
}

function requireRecordId(value: unknown, path: string): string {
  const id = requireNonEmptyString(value, path);
  if (!/^[a-f0-9]{32}$/.test(id)) {
    throw hostBackupError(`${path} must be a 32-character lowercase hexadecimal record ID.`);
  }
  return id;
}

function requireIsoTimestamp(value: unknown, path: string): string {
  const timestamp = requireNonEmptyString(value, path);
  const milliseconds = Date.parse(timestamp);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== timestamp) {
    throw hostBackupError(`${path} must be a canonical ISO 8601 UTC timestamp.`);
  }
  return timestamp;
}

function assertSerializableValue(value: unknown, path: string, seen = new Set<object>()): void {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw hostBackupError(`${path} must contain only finite numbers.`);
    return;
  }
  if (typeof value !== "object") {
    throw hostBackupError(`${path} must contain only JSON-compatible values.`);
  }
  if (seen.has(value)) throw hostBackupError(`${path} must not contain cycles.`);
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertSerializableValue(entry, `${path}[${index}]`, seen));
  } else {
    const object = requireObject(value, path);
    for (const [key, entry] of Object.entries(object)) {
      assertSerializableValue(entry, `${path}.${key}`, seen);
    }
  }
  seen.delete(value);
}

function assertExactKeys(
  object: Record<string, unknown>,
  required: readonly string[],
  path: string,
): void {
  const allowed = new Set(required);
  for (const key of required) {
    if (!(key in object)) throw hostBackupError(`${path}.${key} is required.`);
  }
  for (const key of Object.keys(object)) {
    if (!allowed.has(key)) throw hostBackupError(`${path}.${key} is not supported.`);
  }
}

function assertUnique<T>(
  entries: readonly T[],
  select: (entry: T) => string,
  path: string,
  field: string,
): void {
  const seen = new Set<string>();
  for (const entry of entries) {
    const value = select(entry);
    if (seen.has(value)) throw hostBackupError(`${path} contains duplicate ${field} ${value}.`);
    seen.add(value);
  }
}

function errorMessage(caught: unknown): string {
  return caught instanceof Error ? caught.message : String(caught);
}

function hostBackupError(message: string, cause?: unknown): Error {
  const fullMessage = `HOST_BACKUP_INVALID: ${message}`;
  return cause === undefined ? new Error(fullMessage) : new Error(fullMessage, { cause });
}
