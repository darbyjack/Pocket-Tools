import assert from "node:assert/strict";
import test from "node:test";

import { collection, field, setting } from "@pocket-tools/sdk-contract";

import {
  assertRecordId,
  assertRecordInput,
  assertSettingValue,
} from "./sdk-validation.ts";

const entryCollection = collection({
  title: field.text({ maxLength: 40 }),
  complete: field.boolean(),
  amount: field.money({ optional: true, min: 0 }),
  dueAt: field.datetime({ optional: true }),
});

test("validates every frozen setting value type", () => {
  assert.doesNotThrow(() =>
    assertSettingValue(setting.text({ label: "Title", default: "A", maxLength: 10 }), "Hello", "settings.title"),
  );
  assert.doesNotThrow(() =>
    assertSettingValue(setting.boolean({ label: "Enabled", default: true }), false, "settings.enabled"),
  );
  assert.doesNotThrow(() =>
    assertSettingValue(setting.number({ label: "Count", default: 1, min: 0, max: 5 }), 3, "settings.count"),
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
      ),
    /VALIDATION_FAILED: settings.count/,
  );
});

test("validates exact inserts and partial updates", () => {
  assert.doesNotThrow(() =>
    assertRecordInput(
      entryCollection,
      { title: "Task", complete: false, amount: null },
      "operations[0].record",
    ),
  );
  assert.doesNotThrow(() =>
    assertRecordInput(entryCollection, { complete: true }, "operations[0].changes", true),
  );
});

test("rejects missing, unknown, host-owned, and invalid record fields", () => {
  assert.throws(
    () => assertRecordInput(entryCollection, { title: "Task" }, "record"),
    /record.complete: Required field is missing/,
  );
  assert.throws(
    () =>
      assertRecordInput(
        entryCollection,
        { title: "Task", complete: false, unknown: true },
        "record",
      ),
    /record.unknown: Unknown collection field/,
  );
  assert.throws(
    () =>
      assertRecordInput(
        entryCollection,
        { id: "owned", title: "Task", complete: false },
        "record",
      ),
    /record.id: Record metadata is host-owned/,
  );
  assert.throws(
    () =>
      assertRecordInput(
        entryCollection,
        { title: "Task", complete: false, amount: -1 },
        "record",
      ),
    /record.amount: Value is below the minimum/,
  );
});

test("accepts only host record IDs", () => {
  assert.doesNotThrow(() => assertRecordId("0123456789abcdef0123456789abcdef", "id"));
  assert.throws(() => assertRecordId("pending", "id"), /VALIDATION_FAILED: id/);
});
