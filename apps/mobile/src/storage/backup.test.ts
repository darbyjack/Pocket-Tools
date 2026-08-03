import assert from "node:assert/strict";
import test from "node:test";

import {
  MINI_APP_BACKUP_FORMAT,
  MINI_APP_BACKUP_VERSION,
  parseMiniAppBackup,
  stringifyMiniAppBackup,
  type MiniAppBackupV1,
} from "./backup.ts";

const timestamp = "2026-08-03T21:30:00.000Z";

function validBackup(): MiniAppBackupV1 {
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
  };
}

test("round-trips the exact versioned backup contract", () => {
  const backup = validBackup();
  const serialized = stringifyMiniAppBackup(backup);

  assert.deepEqual(parseMiniAppBackup(serialized), backup);
  assert.equal(serialized.endsWith("\n"), true);
});

test("rejects unsupported formats and versions", () => {
  assert.throws(
    () => parseMiniAppBackup({ ...validBackup(), format: "other" }),
    /BACKUP_INVALID: backup\.format/,
  );
  assert.throws(
    () => parseMiniAppBackup({ ...validBackup(), version: 2 }),
    /BACKUP_INVALID: backup\.version/,
  );
});

test("rejects unknown fields rather than treating them as compatibility data", () => {
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
  assert.ok(setting !== undefined);
  assert.ok(record !== undefined);
  assert.ok(timer !== undefined);

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
});

test("rejects invalid timestamps, record IDs, and non-finite values", () => {
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
});

test("rejects malformed JSON with a stable backup error", () => {
  assert.throws(() => parseMiniAppBackup("{"), /BACKUP_INVALID: Backup is not valid JSON/);
});
