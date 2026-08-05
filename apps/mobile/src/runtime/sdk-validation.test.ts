import assert from "node:assert/strict";
import test from "node:test";

import { collection, field, setting } from "@pocket-tools/sdk-contract";

import { assertRecordId, assertRecordInput, assertSettingValue } from "./sdk-validation.ts";

const entryCollection = collection({
  title: field.text({ maxLength: 40 }),
  complete: field.boolean(),
  amount: field.money({ optional: true, min: 0 }),
  dueAt: field.datetime({ optional: true }),
});

const temporalCollection = collection({
  dueDate: field.date(),
  recordedAt: field.datetime(),
});

test("validates every frozen setting value type with the declared SDK version", () => {
  assert.doesNotThrow(() =>
    assertSettingValue(
      setting.text({ label: "Title", default: "A", maxLength: 10 }),
      "Hello",
      "settings.title",
      "1.0",
    ),
  );
  assert.doesNotThrow(() =>
    assertSettingValue(
      setting.boolean({ label: "Enabled", default: true }),
      false,
      "settings.enabled",
      "1.0",
    ),
  );
  assert.doesNotThrow(() =>
    assertSettingValue(
      setting.number({ label: "Count", default: 1, min: 0, max: 5 }),
      3,
      "settings.count",
      "1.0",
    ),
  );
  assert.doesNotThrow(() =>
    assertSettingValue(
      setting.select({
        label: "Mode",
        default: "one",
        options: [
          { label: "One", value: "one" },
          { label: "Two", value: "two" },
        ],
      }),
      "two",
      "settings.mode",
      "1.0",
    ),
  );
});

test("validates public SDK 1.2 date and multi-select setting values", () => {
  assert.doesNotThrow(() =>
    assertSettingValue(
      setting.date({ label: "Due date", default: "2026-08-04" }),
      "2026-08-05",
      "settings.dueDate",
      "1.2",
    ),
  );
  assert.doesNotThrow(() =>
    assertSettingValue(
      setting.datetime({
        label: "Reminder",
        default: "2026-08-04T12:00:00.000Z",
      }),
      "2026-08-05T12:30:00.000Z",
      "settings.reminderAt",
      "1.2",
    ),
  );
  assert.doesNotThrow(() =>
    assertSettingValue(
      setting.multiSelect({
        label: "Tags",
        options: [
          { label: "Home", value: "home" },
          { label: "Work", value: "work" },
        ],
        default: ["home"],
        minSelections: 1,
        maxSelections: 2,
      }),
      ["home", "work"],
      "settings.tags",
      "1.2",
    ),
  );
});

test("rejects invalid persisted setting values", () => {
  assert.throws(
    () =>
      assertSettingValue(
        setting.number({ label: "Count", default: 1, min: 0, max: 5 }),
        10,
        "settings.count",
        "1.0",
      ),
    /VALIDATION_FAILED: settings.count/,
  );
  assert.throws(
    () =>
      assertSettingValue(
        setting.datetime({
          label: "Reminder",
          default: "2026-08-04T12:00:00.000Z",
        }),
        "2026-08-05T07:30:00.000-05:00",
        "settings.reminderAt",
        "1.2",
      ),
    /canonical UTC date-time/,
  );
});

test("validates exact inserts and partial updates", () => {
  assert.doesNotThrow(() =>
    assertRecordInput(
      entryCollection,
      { title: "Task", complete: false, amount: null },
      "operations[0].record",
      false,
      "1.1",
    ),
  );
  assert.doesNotThrow(() =>
    assertRecordInput(entryCollection, { complete: true }, "operations[0].changes", true, "1.1"),
  );
});

test("uses the explicit manifest version for temporal record validation", () => {
  assert.doesNotThrow(() =>
    assertRecordInput(
      temporalCollection,
      {
        dueDate: "2026-08-05",
        recordedAt: "2026-08-05T12:30:00.000Z",
      },
      "record",
      false,
      "1.2",
    ),
  );
  assert.throws(
    () =>
      assertRecordInput(
        temporalCollection,
        {
          dueDate: "2026-08-05",
          recordedAt: "2026-08-05T07:30:00.000-05:00",
        },
        "record",
        false,
        "1.2",
      ),
    /canonical UTC date-time/,
  );
  assert.throws(
    () =>
      assertRecordInput(
        temporalCollection,
        {
          dueDate: "2026-08-05",
          recordedAt: "2026-08-05T12:30:00.000Z",
        },
        "record",
        false,
        "1.1",
      ),
    /Date fields require SDK 1.2/,
  );
});

test("retains SDK 1.1 date-time compatibility when explicitly requested", () => {
  assert.doesNotThrow(() =>
    assertRecordInput(
      entryCollection,
      {
        title: "Task",
        complete: false,
        amount: null,
        dueAt: "2026-08-05T07:30:00.000-05:00",
      },
      "record",
      false,
      "1.1",
    ),
  );
});

test("rejects missing, unknown, host-owned, and invalid record fields", () => {
  assert.throws(
    () => assertRecordInput(entryCollection, { title: "Task" }, "record", false, "1.1"),
    /record.complete: Required field is missing/,
  );
  assert.throws(
    () =>
      assertRecordInput(
        entryCollection,
        { title: "Task", complete: false, unknown: true },
        "record",
        false,
        "1.1",
      ),
    /record.unknown: Unknown collection field/,
  );
  assert.throws(
    () =>
      assertRecordInput(
        entryCollection,
        { id: "owned", title: "Task", complete: false },
        "record",
        false,
        "1.1",
      ),
    /record.id: Record metadata is host-owned/,
  );
  assert.throws(
    () =>
      assertRecordInput(
        entryCollection,
        { title: "Task", complete: false, amount: -1 },
        "record",
        false,
        "1.1",
      ),
    /record.amount: Value is below the minimum/,
  );
});

test("accepts only host record IDs", () => {
  assert.doesNotThrow(() => assertRecordId("0123456789abcdef0123456789abcdef", "id"));
  assert.throws(() => assertRecordId("pending", "id"), /VALIDATION_FAILED: id/);
});
