import assert from "node:assert/strict";
import test from "node:test";

import { createLifecycleDiagnosticSource } from "../../../apps/mobile/src/diagnostics/fixtures.ts";
import { inspectMiniAppSource } from "./inspection.ts";

test("lifecycle diagnostics use valid SDK v1 scripts with colliding names", async () => {
  const [first, second] = await Promise.all([
    inspectMiniAppSource(
      createLifecycleDiagnosticSource("lifecycle-diagnostic-test-a", "Diagnostic A"),
    ),
    inspectMiniAppSource(
      createLifecycleDiagnosticSource("lifecycle-diagnostic-test-b", "Diagnostic B"),
    ),
  ]);

  assert.equal(first.manifest.id, "lifecycle-diagnostic-test-a");
  assert.equal(second.manifest.id, "lifecycle-diagnostic-test-b");
  assert.deepEqual(Object.keys(first.settings), ["sharedValue"]);
  assert.deepEqual(Object.keys(second.settings), ["sharedValue"]);
  assert.deepEqual(Object.keys(first.collections), ["sharedRecords"]);
  assert.deepEqual(Object.keys(second.collections), ["sharedRecords"]);
  assert.deepEqual(first.screens, ["home", "details"]);
  assert.deepEqual(second.screens, first.screens);
  assert.deepEqual(first.actions, ["seed", "addRecord", "stopTimer", "fail"]);
  assert.deepEqual(second.actions, first.actions);
});
