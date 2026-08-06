import type { DatabaseMigrationFixture } from "./database-migrations.ts";

export const SCHEMA_0_DEVELOPMENT_FIXTURE: DatabaseMigrationFixture = {
  id: "schema-0-development",
  description:
    "Representative pre-versioned development database with installed and rollback sources, metadata, settings, records, timers, and desired notification state.",
  schemaVersion: 0,
  setupSql: `
    CREATE TABLE settings (
      app_id TEXT NOT NULL,
      name TEXT NOT NULL,
      value_json TEXT NOT NULL,
      PRIMARY KEY (app_id, name)
    );

    CREATE TABLE records (
      id TEXT PRIMARY KEY NOT NULL,
      app_id TEXT NOT NULL,
      collection_name TEXT NOT NULL,
      data_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX records_app_collection
      ON records (app_id, collection_name, created_at DESC);

    CREATE TABLE timers (
      app_id TEXT NOT NULL,
      timer_id TEXT NOT NULL,
      started_at TEXT NOT NULL,
      PRIMARY KEY (app_id, timer_id)
    );

    CREATE TABLE installed_mini_apps (
      app_id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      icon TEXT,
      active_source TEXT NOT NULL,
      last_known_good_source TEXT NOT NULL,
      installed_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE app_metadata (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );

    CREATE TABLE notification_registry (
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

    CREATE INDEX notification_registry_reconcile
      ON notification_registry (status, desired, storage_id, notification_id);

    INSERT INTO installed_mini_apps (
      app_id, name, description, icon, active_source,
      last_known_good_source, installed_at, updated_at
    ) VALUES (
      'migration-fixture',
      'Migration Fixture',
      'Schema zero representative state',
      'database',
      'fixture-active-source',
      'fixture-rollback-source',
      '2026-08-01T12:00:00.000Z',
      '2026-08-02T12:00:00.000Z'
    );

    INSERT INTO app_metadata (key, value)
    VALUES ('bundled-mini-apps-v1', '2026-08-01T12:00:00.000Z');

    INSERT INTO settings (app_id, name, value_json)
    VALUES ('migration-fixture', 'fixtureSetting', '"fixture-value"');

    INSERT INTO records (
      id, app_id, collection_name, data_json, created_at, updated_at
    ) VALUES (
      'fixture-record',
      'migration-fixture',
      'fixtureRecords',
      '{"amount":42,"label":"preserved"}',
      '2026-08-01T12:05:00.000Z',
      '2026-08-01T12:06:00.000Z'
    );

    INSERT INTO timers (app_id, timer_id, started_at)
    VALUES ('migration-fixture', 'fixtureTimer', '2026-08-01T12:10:00.000Z');

    INSERT INTO notification_registry (
      storage_id, notification_id, desired, request_json, platform_id,
      status, last_error, updated_at, reconciled_at
    ) VALUES (
      'migration-fixture',
      'fixtureReminder',
      1,
      '{"id":"fixtureReminder","title":"Preserved reminder","trigger":{"type":"date","at":"2026-09-01T12:00:00.000Z","delivery":"standard"}}',
      NULL,
      'pending',
      NULL,
      '2026-08-01T12:15:00.000Z',
      NULL
    );
  `,
};

export const DATABASE_MIGRATION_FIXTURES: readonly DatabaseMigrationFixture[] = [
  SCHEMA_0_DEVELOPMENT_FIXTURE,
];
