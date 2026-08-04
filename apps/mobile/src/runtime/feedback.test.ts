import assert from "node:assert/strict";
import test from "node:test";

import type { RuntimeValue } from "../model.ts";
import { completeRuntimeAction, feedbackMessage } from "./feedback.ts";

const value: RuntimeValue = {
  operations: [],
  effects: [{ type: "feedback", message: "Saved" }],
};

test("returns feedback only after operations and rerender complete", async () => {
  const events: string[] = [];
  const message = await completeRuntimeAction(
    value,
    async () => {
      events.push("commit");
    },
    async () => {
      events.push("rerender");
    },
  );

  events.push(`feedback:${message}`);
  assert.deepEqual(events, ["commit", "rerender", "feedback:Saved"]);
});

test("does not produce feedback when operation application fails", async () => {
  let rerendered = false;
  await assert.rejects(
    () =>
      completeRuntimeAction(
        value,
        async () => {
          throw new Error("commit failed");
        },
        async () => {
          rerendered = true;
        },
      ),
    /commit failed/,
  );
  assert.equal(rerendered, false);
});

test("does not produce feedback when rerender fails", async () => {
  await assert.rejects(
    () =>
      completeRuntimeAction(
        value,
        async () => undefined,
        async () => {
          throw new Error("rerender failed");
        },
      ),
    /rerender failed/,
  );
});

test("returns null when no feedback effect exists", () => {
  assert.equal(feedbackMessage(undefined), null);
  assert.equal(feedbackMessage([]), null);
});
