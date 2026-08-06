import assert from "node:assert/strict";
import test from "node:test";

import {
  HOST_BACKUP_SUPPORTED_VERSIONS,
  MINI_APP_BACKUP_SUPPORTED_VERSIONS,
  readCompleteHostBackup,
  readPortableMiniAppBackup,
} from "./backup-version-dispatch.ts";
import {
  MINI_APP_BACKUP_FORMAT,
  MINI_APP_BACKUP_VERSION,
  type MiniAppBackupV2,
} from "./backup.ts";
import { HOST_BACKUP_FORMAT, HOST_BACKUP_VERSION, type HostBackupV2 } from "./host-backup.ts";

const timestamp = "2026-08-06T13:30:00.000Z";

function miniAppBackup(): MiniAppBackupV2 {
  return {
    format: MINI_APP_BACKUP_FORMAT,
    version: MINI_APP_BACKUP_VERSION,
    exportedAt: timestamp,
    app: {
      id: "versioned-tool",
      name: "Versioned Tool",
      activeSource: "export default active;",
      lastKnownGoodSource: "export default previous;",
      installedAt: timestamp,
      updatedAt: timestamp,
    },
    settings: [],
    records: [],
    timers: [],
    notifications: [],
  };
}

function hostBackup(): HostBackupV2 {
  return {
    format: HOST_BACKUP_FORMAT,
    version: HOST_BACKUP_VERSION,
    exportedAt: timestamp,
    apps: [miniAppBackup()],
    retained: [],
  };
}

test("dispatches independent version-2 readers for portable and host backups", () => {
  const portable = miniAppBackup();
  const host = hostBackup();

  assert.deepEqual(readPortableMiniAppBackup(JSON.stringify(portable)), portable);
  assert.deepEqual(readCompleteHostBackup(JSON.stringify(host)), host);
  assert.deepEqual(MINI_APP_BACKUP_SUPPORTED_VERSIONS, [2]);
  assert.deepEqual(HOST_BACKUP_SUPPORTED_VERSIONS, [2]);
});

test("keeps portable and host format sequences separate", () => {
  assert.throws(
    () => readPortableMiniAppBackup(hostBackup()),
    /BACKUP_INVALID: backup\.format must be pocket-tools-mini-app/,
  );
  assert.throws(
    () => readCompleteHostBackup(miniAppBackup()),
    /HOST_BACKUP_INVALID: backup\.format must be pocket-tools-host/,
  );
});

test("rejects unsupported older versions through the reader registry", () => {
  assert.throws(
    () => readPortableMiniAppBackup({ ...miniAppBackup(), version: 1 }),
    /BACKUP_VERSION_UNSUPPORTED: backup\.version 1 is not supported/,
  );
  assert.throws(
    () => readCompleteHostBackup({ ...hostBackup(), version: 1 }),
    /HOST_BACKUP_VERSION_UNSUPPORTED: backup\.version 1 is not supported/,
  );
});

test("rejects newer unknown versions distinctly from malformed documents", () => {
  assert.throws(
    () => readPortableMiniAppBackup({ ...miniAppBackup(), version: 3 }),
    /BACKUP_VERSION_NEWER: backup\.version 3 is newer than supported version 2/,
  );
  assert.throws(
    () => readCompleteHostBackup({ ...hostBackup(), version: 3 }),
    /HOST_BACKUP_VERSION_NEWER: backup\.version 3 is newer than supported version 2/,
  );
});

test("rejects malformed version envelopes before invoking a version reader", () => {
  assert.throws(
    () => readPortableMiniAppBackup({ ...miniAppBackup(), version: "2" }),
    /BACKUP_INVALID: backup\.version must be a non-negative integer/,
  );
  assert.throws(
    () => readCompleteHostBackup({ ...hostBackup(), version: 2.5 }),
    /HOST_BACKUP_INVALID: backup\.version must be a non-negative integer/,
  );
  assert.throws(
    () => readPortableMiniAppBackup("{"),
    /BACKUP_INVALID: Backup is not valid JSON/,
  );
});
