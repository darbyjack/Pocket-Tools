import assert from "node:assert/strict";
import test from "node:test";

import type { RuntimeValue } from "../model.ts";
import { completeRuntimeAction, feedbackMessage, outputEffect } from "./feedback.ts";

const feedbackValue: RuntimeValue = {
  operations: [],
  effects: [{ type: "feedback", message: "Saved" }],
};

const outputAndFeedbackValue: RuntimeValue = {
  operations: [],
  effects: [
    { type: "feedback", message: "Shared" },
    { type: "share", title: "Pocket Tools", text: "Exported value" },
  ],
};

const ignoreOutput = async () => undefined;

test("performs output after operations and rerender but before feedback", async () => {
  const events: string[] = [];
  const message = await completeRuntimeAction(
    outputAndFeedbackValue,
    async () => {
      events.push("commit");
    },
    async () => {
      events.push("rerender");
    },
    async (effect) => {
      events.push(`${effect.type}:${effect.text}`);
    },
  );

  events.push(`feedback:${message}`);
  assert.deepEqual(events, [
    "commit",
    "rerender",
    "share:Exported value",
    "feedback:Shared",
  ]);
});

test("does not perform output or feedback when operation application fails", async () => {
  let rerendered = false;
  let outputPerformed = false;
  await assert.rejects(
    () =>
      completeRuntimeAction(
        outputAndFeedbackValue,
        async () => {
          throw new Error("commit failed");
        },
        async () => {
          rerendered = true;
        },
        async () => {
          outputPerformed = true;
        },
      ),
    /commit failed/,
  );
  assert.equal(rerendered, false);
  assert.equal(outputPerformed, false);
});

test("does not perform output or feedback when rerender fails", async () => {
  let outputPerformed = false;
  await assert.rejects(
    () =>
      completeRuntimeAction(
        outputAndFeedbackValue,
        async () => undefined,
        async () => {
          throw new Error("rerender failed");
        },
        async () => {
          outputPerformed = true;
        },
      ),
    /rerender failed/,
  );
  assert.equal(outputPerformed, false);
});

test("surfaces output failures after commit and rerender", async () => {
  const events: string[] = [];
  await assert.rejects(
    () =>
      completeRuntimeAction(
        outputAndFeedbackValue,
        async () => {
          events.push("commit");
        },
        async () => {
          events.push("rerender");
        },
        async () => {
          events.push("output");
          throw new Error("share unavailable");
        },
      ),
    /share unavailable/,
  );
  assert.deepEqual(events, ["commit", "rerender", "output"]);
});

test("returns feedback when no output effect exists", async () => {
  assert.equal(
    await completeRuntimeAction(
      feedbackValue,
      async () => undefined,
      async () => undefined,
      ignoreOutput,
    ),
    "Saved",
  );
});

test("extracts output independently of effect order", () => {
  assert.deepEqual(outputEffect(outputAndFeedbackValue.effects), {
    type: "share",
    title: "Pocket Tools",
    text: "Exported value",
  });
  assert.equal(feedbackMessage(outputAndFeedbackValue.effects), "Shared");
  assert.equal(outputEffect(undefined), null);
  assert.equal(feedbackMessage(undefined), null);
});
