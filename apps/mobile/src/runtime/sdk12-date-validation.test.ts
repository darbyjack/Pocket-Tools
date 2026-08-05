import assert from "node:assert/strict";
import test from "node:test";

import type { CollectionDefinition, SettingDefinition } from "../model.ts";
import { assertRecordInput, assertSettingValue } from "./sdk-validation.ts";

const dateSetting: SettingDefinition = {
  type: "date",
  label: "Due date",
  default: "2026-08-03",
  min: "2026-01-01",
  max: "2026-12-31",
  hostSdkVersion: "1.2",
};

const sdk12DateTimeSetting: SettingDefinition = {
  type: "datetime",
  label: "Reminder",
  default: "2026-08-04T03:30:00.000Z",
  min: "2026-01-01T00:00:00.000Z",
  max: "2026-12-31T23:59:59.999Z",
  hostSdkVersion: "1.2",
};

test("validates canonical date setting values and bounds", () => {
  assert.doesNotThrow(() => assertSettingValue(dateSetting, "2026-08-03", "dueDate", "1.2"));
  assert.throws(
    () => assertSettingValue(dateSetting, "2026-02-30", "dueDate", "1.2"),
    /canonical YYYY-MM-DD/,
  );
  assert.throws(
    () => assertSettingValue(dateSetting, "2027-01-01", "dueDate", "1.2"),
    /exceeds the maximum/,
  );
});

test("enforces canonical UTC date-time setting values", () => {
  assert.doesNotThrow(() =>
    assertSettingValue(sdk12DateTimeSetting, "2026-08-04T03:30:00.000Z", "reminderAt", "1.2"),
  );
  assert.throws(
    () =>
      assertSettingValue(
        sdk12DateTimeSetting,
        "2026-08-03T22:30:00.000-05:00",
        "reminderAt",
        "1.2",
      ),
    /canonical UTC date-time/,
  );
  assert.throws(
    () => assertSettingValue(sdk12DateTimeSetting, "2026-08-04T03:30:00.000Z", "reminderAt", "1.1"),
    /Date-time settings require SDK 1\.2/,
  );
});

test("validates date and SDK 1.2 date-time collection records", () => {
  const collection: CollectionDefinition = {
    fields: {
      dueDate: {
        type: "date",
        min: "2026-01-01",
        max: "2026-12-31",
        hostSdkVersion: "1.2",
      },
      recordedAt: {
        type: "datetime",
        hostSdkVersion: "1.2",
      },
    },
  };

  assert.doesNotThrow(() =>
    assertRecordInput(
      collection,
      {
        dueDate: "2026-08-03",
        recordedAt: "2026-08-04T03:30:00.000Z",
      },
      "record",
      false,
      "1.2",
    ),
  );
  assert.throws(
    () =>
      assertRecordInput(
        collection,
        {
          dueDate: "08/03/2026",
          recordedAt: "2026-08-04T03:30:00Z",
        },
        "record",
        false,
        "1.2",
      ),
    /canonical YYYY-MM-DD/,
  );
});

test("retains parseable date-time field behavior for SDK 1.0 and 1.1", () => {
  const legacyCollection: CollectionDefinition = {
    fields: {
      recordedAt: { type: "datetime" },
    },
  };

  assert.doesNotThrow(() =>
    assertRecordInput(
      legacyCollection,
      { recordedAt: "2026-08-03T22:30:00.000-05:00" },
      "record",
      false,
      "1.1",
    ),
  );
  assert.throws(
    () => assertRecordInput(legacyCollection, { recordedAt: "not-a-date" }, "record", false, "1.1"),
    /ISO-compatible date-time/,
  );
});
