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

const legacyDateTimeSetting: SettingDefinition = {
  type: "datetime",
  label: "Legacy timestamp",
  default: "2026-08-03T22:30:00-05:00",
};

test("validates canonical date setting values and bounds", () => {
  assert.doesNotThrow(() => assertSettingValue(dateSetting, "2026-08-03", "dueDate"));
  assert.throws(
    () => assertSettingValue(dateSetting, "2026-02-30", "dueDate"),
    /canonical YYYY-MM-DD/,
  );
  assert.throws(
    () => assertSettingValue(dateSetting, "2027-01-01", "dueDate"),
    /exceeds the maximum/,
  );
});

test("enforces canonical UTC date-time values only for SDK 1.2 definitions", () => {
  assert.doesNotThrow(() =>
    assertSettingValue(sdk12DateTimeSetting, "2026-08-04T03:30:00.000Z", "reminderAt"),
  );
  assert.throws(
    () =>
      assertSettingValue(
        sdk12DateTimeSetting,
        "2026-08-03T22:30:00.000-05:00",
        "reminderAt",
      ),
    /canonical UTC date-time/,
  );

  assert.doesNotThrow(() =>
    assertSettingValue(
      legacyDateTimeSetting,
      "2026-08-03T22:30:00.000-05:00",
      "legacyTimestamp",
    ),
  );
});

test("validates date and date-time collection records", () => {
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
      ),
    /canonical YYYY-MM-DD/,
  );
});
