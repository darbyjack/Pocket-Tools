import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { inspectMiniAppSource } from "./inspection.ts";

const FIXTURE_URL = new URL("../../../docs/fixtures/sdk12-agent-proof.miniapp.js", import.meta.url);

test("the docs-only proof tool validates through the public SDK 1.2 authoring path", async () => {
  const source = await readFile(FIXTURE_URL, "utf8");
  const inspection = await inspectMiniAppSource(source, "sdk12-agent-proof.miniapp.js");

  assert.equal(inspection.manifest.id, "sdk12-acceptance");
  assert.equal(inspection.manifest.sdkVersion, "1.2");
  assert.deepEqual(Object.keys(inspection.settings), [
    "title",
    "notes",
    "amount",
    "dueDate",
    "reminderAt",
    "tags",
  ]);
  assert.deepEqual(Object.keys(inspection.collections), ["tasks"]);
  assert.deepEqual(inspection.screens, ["home"]);
  assert.deepEqual(inspection.actions, [
    "saveTask",
    "toggleTask",
    "copyTask",
    "deleteTask",
    "shareSummary",
    "cancelReminder",
  ]);
});
