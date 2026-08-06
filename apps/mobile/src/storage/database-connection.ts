import * as SQLite from "expo-sqlite";

import { prepareDatabaseForApplication } from "./database-startup.ts";

const databasePromise = openDatabase();

export function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  return databasePromise;
}

async function openDatabase(): Promise<SQLite.SQLiteDatabase> {
  const database = await SQLite.openDatabaseAsync("pocket-tools.db");
  await prepareDatabaseForApplication(database);
  return database;
}
