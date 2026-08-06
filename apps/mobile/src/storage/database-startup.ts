import type * as SQLite from "expo-sqlite";

import {
  assertCurrentDatabaseSchema,
  migrateDatabase,
} from "./database-migrations.ts";

export async function prepareDatabaseForApplication(
  database: SQLite.SQLiteDatabase,
): Promise<void> {
  await migrateDatabase(database);
  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
  `);
  await assertCurrentDatabaseSchema(database);
}
