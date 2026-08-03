import assert from "node:assert/strict";
import test from "node:test";

import { readEmbeddedRuntimeSources } from "./runtime-sources.ts";

test("reads the exact SDK and runner embedded by the Android module", async () => {
  const sources = await readEmbeddedRuntimeSources();
  assert.match(sources.sdk, /export const defineMiniApp/);
  assert.match(sources.sdk, /export const ui/);
  assert.match(sources.runner, /^\(\(definition, request\) => \{/);
  assert.match(sources.runner, /request\.mode === "inspect"/);
});
