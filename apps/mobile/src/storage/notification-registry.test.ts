import assert from "node:assert/strict";
import test from "node:test";
import type * as SQLite from "expo-sqlite";

import type { MiniAppInspection, RuntimeOperation } from "../model.ts";
import {
  notificationHostId,
  prepareNotificationOperations,
} from "./notification-registry.ts";

const inspection: MiniAppInspection = {
  manifest: { id: "reminder-test", name: "Reminder Test", sdkVersion: "1.2" },
  settings: {},
  collections: {},
  screens: ["home", "details"],
  actions: ["save"],
};
const now = "2026-08-04T05:30:00.000Z";

function databaseWithDesired(ids: readonly string[]): SQLite.SQLiteDatabase {
  return {
    async getAllAsync() {
      return ids.map((notification_id) => ({ notification_id }));
    },
  } as unknown as SQLite.SQLiteDatabase;
}

function schedule(id: string, exact = false): RuntimeOperation {
  return {
    type: "notification-schedule",
    request: {
      id,
      title: id,
      trigger: {
        type: "daily",
        hour: 8,
        minute: 0,
        ...(exact ? { delivery: "exact" as const } : {}),
      },
      open: { screen: "details" },
    },
  };
}

test("prepares normalized notification operations in original indexes", async () => {
  const operations: readonly RuntimeOperation[] = [
    { type: "notification-cancel", notificationId: "oldReminder" },
    schedule("dailyReminder"),
    { type: "notification-cancel-all" },
    schedule("replacement"),
  ];
  const prepared = await prepareNotificationOperations(
    databaseWithDesired(["oldReminder"]),
    inspection,
    "installed-copy-one",
    operations,
    { now, exactAlarmAccess: false },
  );

  assert.deepEqual([...prepared.keys()], [0, 1, 2, 3]);
  const daily = prepared.get(1);
  assert.equal(daily?.operation.type, "notification-schedule");
  if (daily?.operation.type === "notification-schedule") {
    assert.deepEqual(daily.operation.request.trigger, {
      type: "daily",
      hour: 8,
      minute: 0,
      delivery: "standard",
    });
  }
});

test("rejects exact requests before transaction preflight succeeds", async () => {
  await assert.rejects(
    prepareNotificationOperations(
      databaseWithDesired([]),
      inspection,
      "reminder-test",
      [schedule("exactReminder", true)],
      { now, exactAlarmAccess: false },
    ),
    /NOTIFICATION_EXACT_PERMISSION_REQUIRED/,
  );

  const prepared = await prepareNotificationOperations(
    databaseWithDesired([]),
    inspection,
    "reminder-test",
    [schedule("exactReminder", true)],
    { now, exactAlarmAccess: true },
  );
  assert.equal(prepared.size, 1);
});

test("enforces the 64 desired schedule limit against current and in-action state", async () => {
  const existing = Array.from({ length: 64 }, (_, index) => `reminder${index}`);

  const replacement = await prepareNotificationOperations(
    databaseWithDesired(existing),
    inspection,
    "reminder-test",
    [schedule("reminder0")],
    { now, exactAlarmAccess: false },
  );
  assert.equal(replacement.size, 1);

  await assert.rejects(
    prepareNotificationOperations(
      databaseWithDesired(existing),
      inspection,
      "reminder-test",
      [schedule("newReminder")],
      { now, exactAlarmAccess: false },
    ),
    /NOTIFICATION_LIMIT_EXCEEDED/,
  );

  const cancelThenAdd = await prepareNotificationOperations(
    databaseWithDesired(existing),
    inspection,
    "reminder-test",
    [
      { type: "notification-cancel", notificationId: "reminder0" },
      schedule("newReminder"),
    ],
    { now, exactAlarmAccess: false },
  );
  assert.equal(cancelThenAdd.size, 2);
});

test("rejects notification operations below SDK 1.2", async () => {
  const legacy: MiniAppInspection = {
    ...inspection,
    manifest: { ...inspection.manifest, sdkVersion: "1.1" },
  };
  await assert.rejects(
    prepareNotificationOperations(
      databaseWithDesired([]),
      legacy,
      "reminder-test",
      [schedule("test")],
      { now, exactAlarmAccess: false },
    ),
    /UNSUPPORTED_SDK_VERSION/,
  );
});

test("host IDs are deterministic and isolated by installed storage identity", () => {
  assert.equal(
    notificationHostId("copy-one", "dailyReminder"),
    notificationHostId("copy-one", "dailyReminder"),
  );
  assert.notEqual(
    notificationHostId("copy-one", "dailyReminder"),
    notificationHostId("copy-two", "dailyReminder"),
  );
});
