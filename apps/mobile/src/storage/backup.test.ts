import assert from "node:assert/strict";
import test from "node:test";

import {
  MINI_APP_BACKUP_FORMAT,
  MINI_APP_BACKUP_VERSION,
  parseMiniAppBackup,
  stringifyMiniAppBackup,
  type MiniAppBackupV2,
} from "./backup.ts";

const timestamp = "2026-08-03T21:30:00.000Z";

function validBackup(): MiniAppBackupV2 {
  return {
    format: MINI_APP_BACKUP_FORMAT,
    version: MINI_APP_BACKUP_VERSION,
    exportedAt: timestamp,
    app: {
      id: "example-tool",
      name: "Example Tool",
      description: "Example backup",
      activeSource: "export default active;",
      lastKnownGoodSource: "export default previous;",
      installedAt: timestamp,
      updatedAt: timestamp,
    },
    settings: [{ name: "hourlyRate", value: 25 }],
    records: [
      {
        id: "0123456789abcdef0123456789abcdef",
        collection: "entries",
        data: { amount: 1.5, complete: false, note: null },
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ],
    timers: [{ id: "activeTimer", startedAt: timestamp }],
    notifications: [
      {
        id: "dailyReminder",
        title: "Daily reminder",
        trigger: { type: "daily", hour: 8, minute: 30, delivery: "standard" },
        open: { screen: "home" },
      },
    ],
  };
}

test("round-trips the exact version-2 backup contract", () => {
  const backup = validBackup();
  const serialized = stringifyMiniAppBackup(backup);

  assert.deepEqual(parseMiniAppBackup(serialized), backup);
  assert.equal(serialized.endsWith("\n"), true);
});

test("rejects unsupported formats and version-1 documents", () => {
  assert.throws(
    () => parseMiniAppBackup({ ...validBackup(), format: "other" }),
    /BACKUP_INVALID: backup\.format/,
  );
  assert.throws(
    () => parseMiniAppBackup({ ...validBackup(), version: 1 }),
    /BACKUP_INVALID: backup\.version/,
  );
});

test("rejects missing notification state and unknown fields", () => {
  const withoutNotifications = { ...validBackup() } as Record<string, unknown>;
  delete withoutNotifications.notifications;
  assert.throws(
    () => parseMiniAppBackup(withoutNotifications),
    /BACKUP_INVALID: backup\.notifications is required/,
  );
  assert.throws(
    () => parseMiniAppBackup({ ...validBackup(), legacy: true }),
    /BACKUP_INVALID: backup\.legacy is not supported/,
  );
});

test("rejects duplicate state identities", () => {
  const backup = validBackup();
  const setting = backup.settings[0];
  const record = backup.records[0];
  const timer = backup.timers[0];
  const notification = backup.notifications[0];
  assert.ok(setting !== undefined);
  assert.ok(record !== undefined);
  assert.ok(timer !== undefined);
  assert.ok(notification !== undefined);

  assert.throws(
    () => parseMiniAppBackup({ ...backup, settings: [...backup.settings, setting] }),
    /duplicate name hourlyRate/,
  );
  assert.throws(
    () => parseMiniAppBackup({ ...backup, records: [...backup.records, record] }),
    /duplicate id 0123456789abcdef0123456789abcdef/,
  );
  assert.throws(
    () => parseMiniAppBackup({ ...backup, timers: [...backup.timers, timer] }),
    /duplicate id activeTimer/,
  );
  assert.throws(
    () =>
      parseMiniAppBackup({
        ...backup,
        notifications: [...backup.notifications, notification],
      }),
    /duplicate ID dailyReminder/,
  );
});

test("rejects invalid timestamps, record IDs, notification shapes, and non-finite values", () => {
  const backup = validBackup();
  const record = backup.records[0];
  assert.ok(record !== undefined);

  assert.throws(
    () => parseMiniAppBackup({ ...backup, exportedAt: "yesterday" }),
    /canonical ISO 8601 UTC timestamp/,
  );
  assert.throws(
    () =>
      parseMiniAppBackup({
        ...backup,
        records: [{ ...record, id: "record-1" }],
      }),
    /32-character lowercase hexadecimal record ID/,
  );
  assert.throws(
    () =>
      parseMiniAppBackup({
        ...backup,
        settings: [{ name: "hourlyRate", value: Number.POSITIVE_INFINITY }],
      }),
    /finite numbers/,
  );
  assert.throws(
    () =>
      parseMiniAppBackup({
        ...backup,
        notifications: [
          {
            id: "dailyReminder",
            title: "Daily reminder",
            trigger: { type: "daily", hour: 24, minute: 0 },
          },
        ],
      }),
    /hour must be an integer from 0 to 23/,
  );
});

test("rejects more than 64 desired schedules", () => {
  const backup = validBackup();
  assert.throws(
    () =>
      parseMiniAppBackup({
        ...backup,
        notifications: Array.from({ length: 65 }, (_, index) => ({
          id: `reminder${index}`,
          title: `Reminder ${index}`,
          trigger: { type: "immediate" },
        })),
      }),
    /at most 64 schedules/,
  );
});

test("rejects malformed JSON with a stable backup error", () => {
  assert.throws(() => parseMiniAppBackup("{"), /BACKUP_INVALID: Backup is not valid JSON/);
});
