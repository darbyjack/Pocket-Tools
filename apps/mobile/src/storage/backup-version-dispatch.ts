import {
  MINI_APP_BACKUP_FORMAT,
  MINI_APP_BACKUP_VERSION,
  parseMiniAppBackup,
  type MiniAppBackupV2,
} from "./backup.ts";
import {
  HOST_BACKUP_FORMAT,
  HOST_BACKUP_VERSION,
  parseHostBackup,
  type HostBackupV2,
} from "./host-backup.ts";

export const MINI_APP_BACKUP_SUPPORTED_VERSIONS = [MINI_APP_BACKUP_VERSION] as const;
export const HOST_BACKUP_SUPPORTED_VERSIONS = [HOST_BACKUP_VERSION] as const;

type BackupReader<T> = (input: unknown) => T;

interface VersionedBackupReaderOptions<T> {
  readonly format: string;
  readonly currentVersion: number;
  readonly readers: Readonly<Record<number, BackupReader<T>>>;
  readonly invalidPrefix: string;
  readonly unsupportedPrefix: string;
  readonly newerPrefix: string;
}

const miniAppReaders: Readonly<Record<number, BackupReader<MiniAppBackupV2>>> = {
  [MINI_APP_BACKUP_VERSION]: parseMiniAppBackup,
};

const hostReaders: Readonly<Record<number, BackupReader<HostBackupV2>>> = {
  [HOST_BACKUP_VERSION]: parseHostBackup,
};

export function readPortableMiniAppBackup(input: unknown): MiniAppBackupV2 {
  return readVersionedBackup(input, {
    format: MINI_APP_BACKUP_FORMAT,
    currentVersion: MINI_APP_BACKUP_VERSION,
    readers: miniAppReaders,
    invalidPrefix: "BACKUP_INVALID",
    unsupportedPrefix: "BACKUP_VERSION_UNSUPPORTED",
    newerPrefix: "BACKUP_VERSION_NEWER",
  });
}

export function readCompleteHostBackup(input: unknown): HostBackupV2 {
  return readVersionedBackup(input, {
    format: HOST_BACKUP_FORMAT,
    currentVersion: HOST_BACKUP_VERSION,
    readers: hostReaders,
    invalidPrefix: "HOST_BACKUP_INVALID",
    unsupportedPrefix: "HOST_BACKUP_VERSION_UNSUPPORTED",
    newerPrefix: "HOST_BACKUP_VERSION_NEWER",
  });
}

function readVersionedBackup<T>(input: unknown, options: VersionedBackupReaderOptions<T>): T {
  const root = parseBackupRoot(input, options.invalidPrefix);
  if (root.format !== options.format) {
    throw new Error(`${options.invalidPrefix}: backup.format must be ${options.format}.`);
  }

  const version = root.version;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 0) {
    throw new Error(`${options.invalidPrefix}: backup.version must be a non-negative integer.`);
  }
  if (version > options.currentVersion) {
    throw new Error(
      `${options.newerPrefix}: backup.version ${version} is newer than supported version ${options.currentVersion}.`,
    );
  }

  const reader = options.readers[version];
  if (reader === undefined) {
    throw new Error(`${options.unsupportedPrefix}: backup.version ${version} is not supported.`);
  }
  return reader(root);
}

function parseBackupRoot(input: unknown, invalidPrefix: string): Record<string, unknown> {
  let value: unknown = input;
  if (typeof input === "string") {
    try {
      value = JSON.parse(input) as unknown;
    } catch (cause) {
      throw new Error(`${invalidPrefix}: Backup is not valid JSON.`, { cause });
    }
  }

  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${invalidPrefix}: backup must be an object.`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error(`${invalidPrefix}: backup must be a plain object.`);
  }
  return value as Record<string, unknown>;
}
