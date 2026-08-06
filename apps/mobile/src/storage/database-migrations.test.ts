import assert from "node:assert/strict";
import test from "node:test";
import type * as SQLite from "expo-sqlite";

import {
  assertCurrentDatabaseSchema,
  CURRENT_DATABASE_SCHEMA_VERSION,
  DATABASE_SCHEMA_V1_SQL,
  loadDatabaseMigrationFixture,
  migrateDatabase,
  readDatabaseSchemaVersion,
} from "./database-migrations.ts";
import { SCHEMA_0_DEVELOPMENT_FIXTURE } from "./database-migration-fixtures.ts";

class FakeDatabase {
  userVersion: number;
  readonly committedSql: string[] = [];
  transactionCount = 0;
  failOn: string | null = null;

  constructor(userVersion = 0) {
    this.userVersion = userVersion;
  }

  async getFirstAsync<T>(sql: string): Promise<T | null> {
    assert.match(sql, /PRAGMA user_version/i);
    return { user_version: this.userVersion } as T;
  }

  async execAsync(sql: string): Promise<void> {
    if (this.failOn !== null && sql.includes(this.failOn)) {
      throw new Error(`Injected migration failure at ${this.failOn}`);
    }
    const version = /PRAGMA\s+user_version\s*=\s*(\d+)/i.exec(sql)?.[1];
    if (version !== undefined) this.userVersion = Number(version);
    this.committedSql.push(sql);
  }

  async withExclusiveTransactionAsync(
    task: (transaction: SQLite.SQLiteDatabase) => Promise<void>,
  ): Promise<void> {
    this.transactionCount += 1;
    const versionBefore = this.userVersion;
    const sqlLengthBefore = this.committedSql.length;
    try {
      await task(this as unknown as SQLite.SQLiteDatabase);
    } catch (error) {
      this.userVersion = versionBefore;
      this.committedSql.splice(sqlLengthBefore);
      throw error;
    }
  }

  asDatabase(): SQLite.SQLiteDatabase {
    return this as unknown as SQLite.SQLiteDatabase;
  }
}

test("creates the production schema from a fresh schema-zero database", async () => {
  const database = new FakeDatabase();

  const version = await migrateDatabase(database.asDatabase());

  assert.equal(version, CURRENT_DATABASE_SCHEMA_VERSION);
  assert.equal(database.userVersion, 1);
  assert.equal(database.transactionCount, 1);
  assert.equal(await readDatabaseSchemaVersion(database.asDatabase()), 1);
  const emittedSql = database.committedSql.join("\n");
  for (const table of [
    "settings",
    "records",
    "timers",
    "installed_mini_apps",
    "app_metadata",
    "notification_registry",
  ]) {
    assert.match(emittedSql, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
  }
  assert.match(emittedSql, /PRAGMA user_version = 1/);
});

test("loads and upgrades the representative schema-zero development fixture", async () => {
  const database = new FakeDatabase();

  await loadDatabaseMigrationFixture(database.asDatabase(), SCHEMA_0_DEVELOPMENT_FIXTURE);
  assert.equal(database.userVersion, 0);
  assert.match(database.committedSql[0] ?? "", /fixture-active-source/);
  assert.match(database.committedSql[0] ?? "", /fixture-rollback-source/);
  assert.match(database.committedSql[0] ?? "", /fixtureSetting/);
  assert.match(database.committedSql[0] ?? "", /fixture-record/);
  assert.match(database.committedSql[0] ?? "", /fixtureTimer/);
  assert.match(database.committedSql[0] ?? "", /fixtureReminder/);

  await migrateDatabase(database.asDatabase());

  assert.equal(database.userVersion, 1);
  assert.equal(database.transactionCount, 2);
});

test("current-schema startup is idempotent and performs no writes", async () => {
  const database = new FakeDatabase(CURRENT_DATABASE_SCHEMA_VERSION);

  const version = await migrateDatabase(database.asDatabase());

  assert.equal(version, CURRENT_DATABASE_SCHEMA_VERSION);
  assert.equal(database.transactionCount, 0);
  assert.deepEqual(database.committedSql, []);
  await assertCurrentDatabaseSchema(database.asDatabase());
});

test("rejects a newer database before starting a transaction or writing", async () => {
  const database = new FakeDatabase(CURRENT_DATABASE_SCHEMA_VERSION + 1);

  await assert.rejects(migrateDatabase(database.asDatabase()), /DATABASE_SCHEMA_NEWER/);

  assert.equal(database.transactionCount, 0);
  assert.deepEqual(database.committedSql, []);
  assert.equal(database.userVersion, CURRENT_DATABASE_SCHEMA_VERSION + 1);
});

test("rolls back schema and version when a migration fails", async () => {
  const database = new FakeDatabase();
  database.failOn = "CREATE TABLE IF NOT EXISTS settings";

  await assert.rejects(migrateDatabase(database.asDatabase()), /Injected migration failure/);

  assert.equal(database.userVersion, 0);
  assert.equal(database.transactionCount, 1);
  assert.deepEqual(database.committedSql, []);
});

test("requires the exact current schema before normal database access", async () => {
  await assert.rejects(
    assertCurrentDatabaseSchema(new FakeDatabase(0).asDatabase()),
    /DATABASE_SCHEMA_NOT_READY/,
  );
  await assert.rejects(
    assertCurrentDatabaseSchema(new FakeDatabase(2).asDatabase()),
    /DATABASE_SCHEMA_NEWER/,
  );
});

test("schema-one SQL stays the complete first production baseline", () => {
  assert.match(DATABASE_SCHEMA_V1_SQL, /records_app_collection/);
  assert.match(DATABASE_SCHEMA_V1_SQL, /notification_registry_reconcile/);
  assert.match(DATABASE_SCHEMA_V1_SQL, /last_known_good_source TEXT NOT NULL/);
  assert.match(DATABASE_SCHEMA_V1_SQL, /request_json TEXT/);
});
