import assert from "node:assert/strict";
import test from "node:test";

import {
  HOST_BACKUP_FORMAT,
  HOST_BACKUP_VERSION,
  parseHostBackup,
  stringifyHostBackup,
  type HostBackupV2,
} from "./host-backup.ts";

const timestamp = "2026-08-04T00:30:00.000Z";

function appBackup(appId = "example-tool", recordId = "0123456789abcdef0123456789abcdef") {
  return {
    format: "pocket-tools-mini-app" as const,
    version: 2 as const,
    exportedAt: timestamp,
    app: {
      id: appId,
      name: "Example Tool",
      activeSource: "export default active;",
      lastKnownGoodSource: "export default previous;",
      installedAt: timestamp,
      updatedAt: timestamp,
    },
    settings: [{ name: "enabled", value: true }],
    records: [
      {
        id: recordId,
        collection: "entries",
        data: { amount: 1 },
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ],
    timers: [{ id: "activeTimer", startedAt: timestamp }],
    notifications: [
      {
        id: "dailyReminder",
        title: "Daily reminder",
        trigger: { type: "daily" as const, hour: 9, minute: 0, delivery: "standard" as const },
      },
    ],
  };
}

function validBackup(): HostBackupV2 {
  return {
    format: HOST_BACKUP_FORMAT,
    version: HOST_BACKUP_VERSION,
    exportedAt: timestamp,
    apps: [appBackup()],
    retained: [
      {
        appId: "removed-tool",
        settings: [{ name: "count", value: 2 }],
        records: [
          {
            id: "fedcba9876543210fedcba9876543210",
            collection: "entries",
            data: { note: "retained" },
            createdAt: timestamp,
            updatedAt: timestamp,
          },
        ],
        timers: [{ id: "runningTimer", startedAt: timestamp }],
      },
    ],
  };
}

test("round-trips installed notifications and notification-free retained namespaces", () => {
  const backup = validBackup();
  const serialized = stringifyHostBackup(backup);
  assert.deepEqual(parseHostBackup(serialized), backup);
  assert.equal(serialized.endsWith("\n"), true);
});

test("rejects duplicate and overlapping app IDs", () => {
  const backup = validBackup();
  assert.throws(
    () => parseHostBackup({ ...backup, apps: [...backup.apps, appBackup()] }),
    /duplicate app ID example-tool/,
  );
  assert.throws(
    () =>
      parseHostBackup({
        ...backup,
        retained: [{ ...backup.retained[0]!, appId: "example-tool" }],
      }),
    /already present in backup\.apps/,
  );
});

test("rejects notifications in retained removed-tool state", () => {
  const backup = validBackup();
  assert.throws(
    () =>
      parseHostBackup({
        ...backup,
        retained: [{ ...backup.retained[0]!, notifications: [] }],
      }),
    /notifications is not supported/,
  );
});

test("rejects internal namespaces", () => {
  const backup = validBackup();
  assert.throws(
    () =>
      parseHostBackup({
        ...backup,
        retained: [{ ...backup.retained[0]!, appId: "lifecycle-diagnostic-example" }],
      }),
    /internal host namespace/,
  );
});

test("rejects globally duplicated record IDs", () => {
  const backup = validBackup();
  assert.throws(
    () =>
      parseHostBackup({
        ...backup,
        retained: [
          {
            ...backup.retained[0]!,
            records: [{ ...backup.apps[0]!.records[0]! }],
          },
        ],
      }),
    /reuses global record ID/,
  );
});

test("rejects malformed JSON, unknown fields, and version-1 documents", () => {
  const backup = validBackup();
  assert.throws(() => parseHostBackup("{"), /HOST_BACKUP_INVALID: Backup is not valid JSON/);
  assert.throws(
    () => parseHostBackup({ ...backup, legacy: true }),
    /backup\.legacy is not supported/,
  );
  assert.throws(() => parseHostBackup({ ...backup, version: 1 }), /backup\.version must be 2/);
});
