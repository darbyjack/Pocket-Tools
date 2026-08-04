import assert from "node:assert/strict";
import test from "node:test";
import type * as SQLite from "expo-sqlite";

import {
  listNotificationReconciliationEntries,
  readDesiredNotificationRequests,
} from "./notification-registry.ts";

const timestamp = "2026-08-04T05:30:00.000Z";

test("revalidates stored desired request JSON before returning it", async () => {
  const database = {
    async execAsync() {},
    async getAllAsync() {
      return [
        {
          notification_id: "dailyReminder",
          request_json: JSON.stringify({
            id: "dailyReminder",
            title: "Daily reminder",
            trigger: { type: "daily", hour: 24, minute: 0 },
          }),
        },
      ];
    },
  } as unknown as SQLite.SQLiteDatabase;

  await assert.rejects(
    readDesiredNotificationRequests(database, "reminder-tool"),
    /NOTIFICATION_RECONCILIATION_FAILED/,
  );
});

test("reconciliation enumeration includes already-scheduled desired rows", async () => {
  let query = "";
  const database = {
    async execAsync() {},
    async getAllAsync(sql: string) {
      query = sql;
      return [
        {
          storage_id: "reminder-tool",
          notification_id: "dailyReminder",
          desired: 1,
          request_json: JSON.stringify({
            id: "dailyReminder",
            title: "Daily reminder",
            trigger: { type: "daily", hour: 8, minute: 0, delivery: "standard" },
          }),
          platform_id: "platform-1",
          status: "scheduled",
          last_error: null,
          updated_at: timestamp,
          reconciled_at: timestamp,
        },
      ];
    },
  } as unknown as SQLite.SQLiteDatabase;

  const entries = await listNotificationReconciliationEntries(database);
  assert.equal(entries.length, 1);
  assert.equal(entries[0]?.status, "scheduled");
  assert.doesNotMatch(query, /WHERE desired = 0|status != 'scheduled'/);
});
