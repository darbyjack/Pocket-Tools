import assert from "node:assert/strict";
import test from "node:test";

import { invokeIsolatedListAction } from "./list-row-action.ts";

test("stops row propagation before invoking the visible action", () => {
  const order: string[] = [];
  invokeIsolatedListAction(
    {
      stopPropagation() {
        order.push("stop");
      },
    },
    () => order.push("invoke"),
  );

  assert.deepEqual(order, ["stop", "invoke"]);
});
