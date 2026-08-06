import type * as SQLite from "expo-sqlite";

export const CURRENT_DATABASE_SCHEMA_VERSION = 1;

export const DATABASE_SCHEMA_V1_SQL = `
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
`;

interface UserVersionRow {
  readonly user_version: number;
}

interface DatabaseMigration {
  readonly from: number;
  readonly to: number;
  readonly migrate: (database: SQLite.SQLiteDatabase) => Promise<void>;
}

export interface DatabaseMigrationFixture {
  readonly id: string;
  readonly description: string;
  readonly schemaVersion: number;
  readonly setupSql: string;
}

const migrations: readonly DatabaseMigration[] = [
  {
    from: 0,
    to: 1,
    async migrate(database) {
      await database.execAsync(DATABASE_SCHEMA_V1_SQL);
    },
  },
];

export async function readDatabaseSchemaVersion(
  database: Pick<SQLite.SQLiteDatabase, "getFirstAsync">,
): Promise<number> {
  const row = await database.getFirstAsync<UserVersionRow>("PRAGMA user_version;");
  const version = row?.user_version;
  if (!Number.isInteger(version) || version === undefined || version < 0) {
    throw new Error("DATABASE_SCHEMA_INVALID: SQLite returned an invalid PRAGMA user_version.");
  }
  return version;
}

export async function assertCurrentDatabaseSchema(
  database: Pick<SQLite.SQLiteDatabase, "getFirstAsync">,
): Promise<void> {
  const version = await readDatabaseSchemaVersion(database);
  if (version > CURRENT_DATABASE_SCHEMA_VERSION) {
    throw newerSchemaError(version);
  }
  if (version < CURRENT_DATABASE_SCHEMA_VERSION) {
    throw new Error(
      `DATABASE_SCHEMA_NOT_READY: Expected schema ${CURRENT_DATABASE_SCHEMA_VERSION}, found ${version}.`,
    );
  }
}

export async function migrateDatabase(database: SQLite.SQLiteDatabase): Promise<number> {
  let version = await readDatabaseSchemaVersion(database);
  if (version > CURRENT_DATABASE_SCHEMA_VERSION) {
    throw newerSchemaError(version);
  }

  while (version < CURRENT_DATABASE_SCHEMA_VERSION) {
    const migration = migrations.find((candidate) => candidate.from === version);
    if (migration === undefined || migration.to !== version + 1) {
      throw new Error(
        `DATABASE_MIGRATION_MISSING: No ordered migration exists from schema ${version}.`,
      );
    }

    await database.withExclusiveTransactionAsync(async (transaction) => {
      const transactionVersion = await readDatabaseSchemaVersion(transaction);
      if (transactionVersion !== migration.from) {
        throw new Error(
          `DATABASE_MIGRATION_RACE: Expected schema ${migration.from}, found ${transactionVersion}.`,
        );
      }
      await migration.migrate(transaction);
      await transaction.execAsync(`PRAGMA user_version = ${migration.to};`);
    });

    const migratedVersion = await readDatabaseSchemaVersion(database);
    if (migratedVersion !== migration.to) {
      throw new Error(
        `DATABASE_MIGRATION_INCOMPLETE: Expected schema ${migration.to}, found ${migratedVersion}.`,
      );
    }
    version = migratedVersion;
  }

  return version;
}

export async function loadDatabaseMigrationFixture(
  database: SQLite.SQLiteDatabase,
  fixture: DatabaseMigrationFixture,
): Promise<void> {
  if (!Number.isInteger(fixture.schemaVersion) || fixture.schemaVersion < 0) {
    throw new Error(`DATABASE_FIXTURE_INVALID: ${fixture.id} has an invalid schema version.`);
  }
  if (fixture.schemaVersion > CURRENT_DATABASE_SCHEMA_VERSION) {
    throw new Error(
      `DATABASE_FIXTURE_INVALID: ${fixture.id} targets unsupported schema ${fixture.schemaVersion}.`,
    );
  }

  await database.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.execAsync(fixture.setupSql);
    await transaction.execAsync(`PRAGMA user_version = ${fixture.schemaVersion};`);
  });
}

function newerSchemaError(version: number): Error {
  return new Error(
    `DATABASE_SCHEMA_NEWER: Database schema ${version} is newer than supported schema ${CURRENT_DATABASE_SCHEMA_VERSION}. Update Pocket Tools before modifying this database.`,
  );
}
