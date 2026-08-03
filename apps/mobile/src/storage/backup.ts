import type { MiniAppInspection, SerializableValue } from "../model.ts";
import { assertRecordInput, assertSettingValue } from "../runtime/sdk-validation.ts";
import { isDiagnosticAppId, isPreviewStorageId } from "./namespaces.ts";

export const MINI_APP_BACKUP_FORMAT = "pocket-tools-mini-app";
export const MINI_APP_BACKUP_VERSION = 1;

export interface MiniAppBackupApp {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly icon?: string;
  readonly activeSource: string;
  readonly lastKnownGoodSource: string;
  readonly installedAt: string;
  readonly updatedAt: string;
}

export interface MiniAppBackupSetting {
  readonly name: string;
  readonly value: SerializableValue;
}

export interface MiniAppBackupRecord {
  readonly id: string;
  readonly collection: string;
  readonly data: Readonly<Record<string, SerializableValue>>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface MiniAppBackupTimer {
  readonly id: string;
  readonly startedAt: string;
}

export interface MiniAppBackupV1 {
  readonly format: typeof MINI_APP_BACKUP_FORMAT;
  readonly version: typeof MINI_APP_BACKUP_VERSION;
  readonly exportedAt: string;
  readonly app: MiniAppBackupApp;
  readonly settings: readonly MiniAppBackupSetting[];
  readonly records: readonly MiniAppBackupRecord[];
  readonly timers: readonly MiniAppBackupTimer[];
}

export function parseMiniAppBackup(input: unknown): MiniAppBackupV1 {
  let value: unknown = input;
  if (typeof input === "string") {
    try {
      value = JSON.parse(input) as unknown;
    } catch (cause) {
      throw backupError("Backup is not valid JSON.", cause);
    }
  }

  const root = requireObject(value, "backup");
  assertExactKeys(
    root,
    ["format", "version", "exportedAt", "app", "settings", "records", "timers"],
    [],
    "backup",
  );

  if (root.format !== MINI_APP_BACKUP_FORMAT) {
    throw backupError(`backup.format must be ${MINI_APP_BACKUP_FORMAT}.`);
  }
  if (root.version !== MINI_APP_BACKUP_VERSION) {
    throw backupError(`backup.version must be ${MINI_APP_BACKUP_VERSION}.`);
  }

  const app = parseApp(root.app);
  const settings = requireArray(root.settings, "backup.settings").map((entry, index) =>
    parseSetting(entry, index),
  );
  const records = requireArray(root.records, "backup.records").map((entry, index) =>
    parseRecord(entry, index),
  );
  const timers = requireArray(root.timers, "backup.timers").map((entry, index) =>
    parseTimer(entry, index),
  );

  assertUnique(settings, (entry) => entry.name, "backup.settings", "name");
  assertUnique(records, (entry) => entry.id, "backup.records", "id");
  assertUnique(timers, (entry) => entry.id, "backup.timers", "id");

  return {
    format: MINI_APP_BACKUP_FORMAT,
    version: MINI_APP_BACKUP_VERSION,
    exportedAt: requireIsoTimestamp(root.exportedAt, "backup.exportedAt"),
    app,
    settings,
    records,
    timers,
  };
}

export function stringifyMiniAppBackup(backup: MiniAppBackupV1): string {
  return `${JSON.stringify(parseMiniAppBackup(backup), null, 2)}\n`;
}

export function validateMiniAppBackupForRestore(
  backup: MiniAppBackupV1,
  activeInspection: MiniAppInspection,
  lastKnownGoodInspection: MiniAppInspection,
): void {
  const parsed = parseMiniAppBackup(backup);
  const appId = parsed.app.id;

  if (isPreviewStorageId(appId) || isDiagnosticAppId(appId)) {
    throw backupError("Internal host namespaces cannot be restored as installed mini apps.");
  }
  if (activeInspection.manifest.id !== appId) {
    throw backupError("The active source manifest ID does not match backup.app.id.");
  }
  if (lastKnownGoodInspection.manifest.id !== appId) {
    throw backupError("The last-known-good source manifest ID does not match backup.app.id.");
  }
  if (activeInspection.manifest.name !== parsed.app.name) {
    throw backupError("The active source manifest name does not match backup.app.name.");
  }
  if (activeInspection.manifest.description !== parsed.app.description) {
    throw backupError("The active source manifest description does not match the backup metadata.");
  }
  if (activeInspection.manifest.icon !== parsed.app.icon) {
    throw backupError("The active source manifest icon does not match the backup metadata.");
  }

  for (const setting of parsed.settings) {
    const definition =
      activeInspection.settings[setting.name] ?? lastKnownGoodInspection.settings[setting.name];
    if (definition === undefined) {
      throw backupError(`backup.settings.${setting.name} is not declared by either saved source.`);
    }
    assertSettingValue(definition, setting.value, `backup.settings.${setting.name}`);
  }

  for (const record of parsed.records) {
    const definition =
      activeInspection.collections[record.collection] ??
      lastKnownGoodInspection.collections[record.collection];
    if (definition === undefined) {
      throw backupError(
        `backup.records.${record.id} uses collection ${record.collection}, which is not declared by either saved source.`,
      );
    }
    assertRecordInput(definition, record.data, `backup.records.${record.id}.data`);
  }
}

function parseApp(value: unknown): MiniAppBackupApp {
  const app = requireObject(value, "backup.app");
  assertExactKeys(
    app,
    ["id", "name", "activeSource", "lastKnownGoodSource", "installedAt", "updatedAt"],
    ["description", "icon"],
    "backup.app",
  );

  const description = readOptionalString(app, "description", "backup.app.description");
  const icon = readOptionalString(app, "icon", "backup.app.icon");

  return {
    id: requireAppId(app.id, "backup.app.id"),
    name: requireNonEmptyString(app.name, "backup.app.name"),
    ...(description === undefined ? {} : { description }),
    ...(icon === undefined ? {} : { icon }),
    activeSource: requireNonEmptyString(app.activeSource, "backup.app.activeSource"),
    lastKnownGoodSource: requireNonEmptyString(
      app.lastKnownGoodSource,
      "backup.app.lastKnownGoodSource",
    ),
    installedAt: requireIsoTimestamp(app.installedAt, "backup.app.installedAt"),
    updatedAt: requireIsoTimestamp(app.updatedAt, "backup.app.updatedAt"),
  };
}

function parseSetting(value: unknown, index: number): MiniAppBackupSetting {
  const path = `backup.settings[${index}]`;
  const setting = requireObject(value, path);
  assertExactKeys(setting, ["name", "value"], [], path);
  assertSerializableValue(setting.value, `${path}.value`);
  return {
    name: requireMemberName(setting.name, `${path}.name`),
    value: setting.value as SerializableValue,
  };
}

function parseRecord(value: unknown, index: number): MiniAppBackupRecord {
  const path = `backup.records[${index}]`;
  const record = requireObject(value, path);
  assertExactKeys(record, ["id", "collection", "data", "createdAt", "updatedAt"], [], path);
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

function parseTimer(value: unknown, index: number): MiniAppBackupTimer {
  const path = `backup.timers[${index}]`;
  const timer = requireObject(value, path);
  assertExactKeys(timer, ["id", "startedAt"], [], path);
  return {
    id: requireMemberName(timer.id, `${path}.id`),
    startedAt: requireIsoTimestamp(timer.startedAt, `${path}.startedAt`),
  };
}

function requireObject(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw backupError(`${path} must be an object.`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw backupError(`${path} must be a plain object.`);
  }
  return value as Record<string, unknown>;
}

function requireArray(value: unknown, path: string): readonly unknown[] {
  if (!Array.isArray(value)) throw backupError(`${path} must be an array.`);
  return value;
}

function requireNonEmptyString(value: unknown, path: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw backupError(`${path} must be a non-empty string.`);
  }
  return value;
}

function readOptionalString(
  object: Record<string, unknown>,
  key: string,
  path: string,
): string | undefined {
  if (!(key in object)) return undefined;
  const value = object[key];
  if (typeof value !== "string") throw backupError(`${path} must be a string.`);
  return value;
}

function requireAppId(value: unknown, path: string): string {
  const id = requireNonEmptyString(value, path);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
    throw backupError(`${path} must use lowercase kebab-case.`);
  }
  return id;
}

function requireMemberName(value: unknown, path: string): string {
  const name = requireNonEmptyString(value, path);
  if (!/^[a-z][A-Za-z0-9]*$/.test(name)) {
    throw backupError(`${path} must use lower camelCase.`);
  }
  return name;
}

function requireRecordId(value: unknown, path: string): string {
  const id = requireNonEmptyString(value, path);
  if (!/^[a-f0-9]{32}$/.test(id)) {
    throw backupError(`${path} must be a 32-character lowercase hexadecimal record ID.`);
  }
  return id;
}

function requireIsoTimestamp(value: unknown, path: string): string {
  const timestamp = requireNonEmptyString(value, path);
  const milliseconds = Date.parse(timestamp);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== timestamp) {
    throw backupError(`${path} must be a canonical ISO 8601 UTC timestamp.`);
  }
  return timestamp;
}

function assertSerializableValue(value: unknown, path: string, seen = new Set<object>()): void {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw backupError(`${path} must contain only finite numbers.`);
    return;
  }
  if (typeof value !== "object") {
    throw backupError(`${path} must contain only JSON-compatible values.`);
  }
  if (seen.has(value)) throw backupError(`${path} must not contain cycles.`);
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
  optional: readonly string[],
  path: string,
): void {
  const allowed = new Set([...required, ...optional]);
  for (const key of required) {
    if (!(key in object)) throw backupError(`${path}.${key} is required.`);
  }
  for (const key of Object.keys(object)) {
    if (!allowed.has(key)) throw backupError(`${path}.${key} is not supported.`);
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
    if (seen.has(value)) throw backupError(`${path} contains duplicate ${field} ${value}.`);
    seen.add(value);
  }
}

function backupError(message: string, cause?: unknown): Error {
  const fullMessage = `BACKUP_INVALID: ${message}`;
  return cause === undefined ? new Error(fullMessage) : new Error(fullMessage, { cause });
}
