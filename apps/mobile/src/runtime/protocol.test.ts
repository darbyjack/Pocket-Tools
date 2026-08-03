import assert from "node:assert/strict";
import test from "node:test";

import { metricValue, settingIsVisible, timerElapsedSeconds } from "./protocol.ts";

test("reconstructs a durable timer from its start timestamp", () => {
  assert.equal(
    timerElapsedSeconds(
      {
        id: "currentTrip",
        startedAt: "2026-08-03T10:00:00.000Z",
        elapsedSeconds: 0,
      },
      Date.parse("2026-08-03T10:10:00.000Z"),
    ),
    600,
  );
});

test("calculates a live money metric without rerunning the script", () => {
  assert.equal(
    metricValue(
      {
        type: "metric",
        label: "Gross earnings equivalent",
        value: 0,
        format: "money",
        liveTimer: { timerId: "currentTrip", ratePerHour: 60 },
      },
      {
        currentTrip: {
          id: "currentTrip",
          startedAt: "2026-08-03T10:00:00.000Z",
          elapsedSeconds: 0,
        },
      },
      Date.parse("2026-08-03T10:10:00.000Z"),
    ),
    10,
  );
});

test("uses declarative setting visibility", () => {
  const definition = {
    type: "money" as const,
    label: "Hourly rate",
    default: 25,
    visibleWhen: { setting: "payType", equals: "hourly" },
  };
  assert.equal(settingIsVisible(definition, { payType: "hourly" }), true);
  assert.equal(settingIsVisible(definition, { payType: "salary" }), false);
});
