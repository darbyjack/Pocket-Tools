import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const GUIDE_URL = new URL("../../../docs/AGENT_AUTHORING.md", import.meta.url);
const FIXTURE_URL = new URL(
  "../../../docs/fixtures/agent-template.miniapp.js",
  import.meta.url,
);

const START_MARKER = "<!-- BEGIN fixture: agent-template.miniapp.js -->";
const END_MARKER = "<!-- END fixture: agent-template.miniapp.js -->";
const JAVASCRIPT_FENCE = "```js";

test("keeps the canonical guide template identical to its executable fixture", async () => {
  const [guideSource, fixtureSource] = await Promise.all([
    readFile(GUIDE_URL, "utf8"),
    readFile(FIXTURE_URL, "utf8"),
  ]);
  const guide = normalizeLineEndings(guideSource);
  const fixture = normalizeLineEndings(fixtureSource);

  const startMarker = guide.indexOf(START_MARKER);
  assert.notEqual(startMarker, -1, "The guide is missing the fixture start marker.");

  const fenceStart = guide.indexOf(
    JAVASCRIPT_FENCE,
    startMarker + START_MARKER.length,
  );
  assert.notEqual(fenceStart, -1, "The guide is missing the fixture code fence.");

  const fenceLineEnd = guide.indexOf("\n", fenceStart + JAVASCRIPT_FENCE.length);
  assert.notEqual(
    fenceLineEnd,
    -1,
    "The guide fixture code fence is missing its content line.",
  );

  const endMarker = guide.indexOf(END_MARKER, fenceLineEnd + 1);
  assert.notEqual(endMarker, -1, "The guide is missing the fixture end marker.");

  const fenceEnd = guide.lastIndexOf("\n```", endMarker);
  assert.ok(
    fenceEnd > fenceLineEnd,
    "The guide is missing the fixture closing code fence.",
  );

  assert.equal(`${guide.slice(fenceLineEnd + 1, fenceEnd).trimEnd()}\n`, fixture);
});

function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n?/g, "\n");
}
