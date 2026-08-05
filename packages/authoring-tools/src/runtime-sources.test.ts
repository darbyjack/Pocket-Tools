import assert from "node:assert/strict";
import test from "node:test";

import { readEmbeddedRuntimeSources } from "./runtime-sources.ts";

test("reconstructs the exact composed Android SDK 1.2 runtime", async () => {
  const sources = await readEmbeddedRuntimeSources();

  for (const builder of ["multiSelect", "badge", "progress", "dateInput", "datetimeInput"]) {
    assert.match(sources.sdk, new RegExp(`\\b${builder}:`));
  }

  assert.match(sources.runner, /^\(\(baseRunner\) => \{/);
  assert.match(sources.runner, /request\.mode === "inspect"/);
  assert.match(sources.runner, /notification-schedule/);
  assert.match(sources.runner, /feedback/);
  assert.match(sources.runner, /output\.share/);
  assert.match(sources.runner, /Fixed host icons require SDK 1\.2/);
  assert.match(sources.runner, /Progress nodes require SDK 1\.2/);
});
