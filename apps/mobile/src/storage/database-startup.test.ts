import assert from "node:assert/strict";
import test from "node:test";
import type * as SQLite from "expo-sqlite";

import { CURRENT_DATABASE_SCHEMA_VERSION } from "./database-migrations.ts";
import { prepareDatabaseForApplication } from "./database-startup.ts";

class FakeDatabase {
  userVersion: number;
  readonly executedSql: string[] = [];
  transactionCount = 0;

  constructor(userVersion = 0) {
    this.userVersion = userVersion;
  }

  async getFirstAsync<T>(): Promise<T | null> {
    return { user_version: this.userVersion } as T;
  }

  async execAsync(sql: string): Promise<void> {
    const version = /PRAGMA\s+user_version\s*=\s*(\d+)/i.exec(sql)?.[1];
    if (version !== undefined) this.userVersion = Number(version);
    this.executedSql.push(sql);
  }

  async withExclusiveTransactionAsync(
    task: (transaction: SQLite.SQLiteDatabase) => Promise<void>,
  ): Promise<void> {
    this.transactionCount += 1;
    await task(this as unknown as SQLite.SQLiteDatabase);
  }

  asDatabase(): SQLite.SQLiteDatabase {
    return this as unknown as SQLite.SQLiteDatabase;
  }
}

test("prepares the current schema before enabling normal database access", async () => {
  const database = new FakeDatabase();

  await prepareDatabaseForApplication(database.asDatabase());

  assert.equal(database.userVersion, CURRENT_DATABASE_SCHEMA_VERSION);
  assert.equal(database.transactionCount, 1);
  const sql = database.executedSql.join("\n");
  assert.match(sql, /CREATE TABLE IF NOT EXISTS settings/);
  assert.match(sql, /PRAGMA journal_mode = WAL/);
  assert.match(sql, /PRAGMA foreign_keys = ON/);
});

test("rejects a newer database before configuration or migration writes", async () => {
  const database = new FakeDatabase(CURRENT_DATABASE_SCHEMA_VERSION + 1);

  await assert.rejects(
    prepareDatabaseForApplication(database.asDatabase()),
    /DATABASE_SCHEMA_NEWER/,
  );

  assert.equal(database.transactionCount, 0);
  assert.deepEqual(database.executedSql, []);
});
