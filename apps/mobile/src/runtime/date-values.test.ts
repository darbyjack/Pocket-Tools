import assert from "node:assert/strict";
import test from "node:test";

import {
  combineLocalDateAndTime,
  dateStringToLocalDate,
  isCanonicalDate,
  isCanonicalDateTime,
  localDateToDateString,
} from "./date-values.ts";

test("accepts real canonical calendar dates", () => {
  assert.equal(isCanonicalDate("2024-02-29"), true);
  assert.equal(isCanonicalDate("2026-08-03"), true);
  assert.equal(isCanonicalDate("2023-02-29"), false);
  assert.equal(isCanonicalDate("2026-13-01"), false);
  assert.equal(isCanonicalDate("2026-1-01"), false);
  assert.equal(isCanonicalDate("0000-01-01"), false);
});

test("accepts only canonical UTC millisecond timestamps", () => {
  assert.equal(isCanonicalDateTime("2026-08-04T03:30:00.000Z"), true);
  assert.equal(isCanonicalDateTime("2026-08-04T03:30:00Z"), false);
  assert.equal(isCanonicalDateTime("2026-08-03T22:30:00.000-05:00"), false);
  assert.equal(isCanonicalDateTime("2026-08-04T03:30:00.000"), false);
  assert.equal(isCanonicalDateTime("2026-02-30T03:30:00.000Z"), false);
});

test("round trips date-only values without UTC conversion", () => {
  const date = dateStringToLocalDate("2026-08-03");
  assert.equal(localDateToDateString(date), "2026-08-03");
});

test("combines a local date and time with zero seconds", () => {
  const date = new Date(2026, 7, 3, 12, 0, 0, 0);
  const time = new Date(2026, 0, 1, 19, 45, 37, 500);
  const combined = combineLocalDateAndTime(date, time);
  assert.equal(combined.getFullYear(), 2026);
  assert.equal(combined.getMonth(), 7);
  assert.equal(combined.getDate(), 3);
  assert.equal(combined.getHours(), 19);
  assert.equal(combined.getMinutes(), 45);
  assert.equal(combined.getSeconds(), 0);
  assert.equal(combined.getMilliseconds(), 0);
});
