import assert from "node:assert/strict";
import test from "node:test";

import { elapsedSecondsSince } from "./time.ts";

test("reconstructs elapsed time from a persisted UTC timestamp", () => {
  assert.equal(
    elapsedSecondsSince("2026-08-03T12:00:00.000Z", Date.parse("2026-08-03T12:01:30.500Z")),
    90.5,
  );
});

test("never returns negative or non-finite elapsed time", () => {
  assert.equal(
    elapsedSecondsSince("2026-08-03T12:00:10.000Z", Date.parse("2026-08-03T12:00:00.000Z")),
    0,
  );
  assert.equal(elapsedSecondsSince("not-a-date", Date.now()), 0);
});
