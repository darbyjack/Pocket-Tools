import assert from "node:assert/strict";
import test from "node:test";

import type { MiniAppInspection } from "../model.ts";
import {
  MINI_APP_BACKUP_FORMAT,
  MINI_APP_BACKUP_VERSION,
  validateMiniAppBackupForRestore,
  type MiniAppBackupV2,
} from "./backup.ts";

const timestamp = "2026-08-04T05:30:00.000Z";

function inspection(
  sdkVersion: "1.1" | "1.2",
  screens: readonly string[] = ["home", "details"],
): MiniAppInspection {
  return {
    manifest: { id: "reminder-tool", name: "Reminder Tool", sdkVersion },
    settings: {},
    collections: {},
    screens,
    actions: [],
  };
}

function backup(): MiniAppBackupV2 {
  return {
    format: MINI_APP_BACKUP_FORMAT,
    version: MINI_APP_BACKUP_VERSION,
    exportedAt: timestamp,
    app: {
      id: "reminder-tool",
      name: "Reminder Tool",
      activeSource: "active",
      lastKnownGoodSource: "previous",
      installedAt: timestamp,
      updatedAt: timestamp,
    },
    settings: [],
    records: [],
    timers: [],
    notifications: [
      {
        id: "dailyReminder",
        title: "Daily reminder",
        trigger: { type: "daily", hour: 8, minute: 0, delivery: "standard" },
        open: { screen: "details", input: { recordId: "abc" } },
      },
    ],
  };
}

test("accepts notification targets declared by either saved SDK 1.2 source", () => {
  assert.doesNotThrow(() =>
    validateMiniAppBackupForRestore(
      backup(),
      inspection("1.2", ["home"]),
      inspection("1.2", ["home", "details"]),
    ),
  );
});

test("requires a saved SDK 1.2 source for notification schedules", () => {
  assert.throws(
    () => validateMiniAppBackupForRestore(backup(), inspection("1.1"), inspection("1.1")),
    /Notification schedules require at least one saved SDK 1.2 source/,
  );
});

test("rejects notification targets absent from both saved sources", () => {
  assert.throws(
    () =>
      validateMiniAppBackupForRestore(
        backup(),
        inspection("1.2", ["home"]),
        inspection("1.2", ["home"]),
      ),
    /must name a declared screen/,
  );
});

test("preserves exact desired requests without requiring current device permission", () => {
  const exactBackup: MiniAppBackupV2 = {
    ...backup(),
    notifications: [
      {
        id: "exactReminder",
        title: "Exact reminder",
        trigger: { type: "daily", hour: 8, minute: 0, delivery: "exact" },
      },
    ],
  };
  assert.doesNotThrow(() =>
    validateMiniAppBackupForRestore(exactBackup, inspection("1.2"), inspection("1.2")),
  );
});
