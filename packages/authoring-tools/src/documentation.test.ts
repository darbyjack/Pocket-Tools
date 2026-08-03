import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const GUIDE_URL = new URL("../../../docs/AGENT_AUTHORING.md", import.meta.url);
const FIXTURE_URL = new URL(
  "../../../docs/fixtures/agent-template.miniapp.js",
  import.meta.url,
);

const START = "<!-- BEGIN fixture: agent-template.miniapp.js -->\n```js\n";
const END = "\n```\n<!-- END fixture: agent-template.miniapp.js -->";

test("keeps the canonical guide template identical to its executable fixture", async () => {
  const [guide, fixture] = await Promise.all([
    readFile(GUIDE_URL, "utf8"),
    readFile(FIXTURE_URL, "utf8"),
  ]);
  const start = guide.indexOf(START);
  assert.notEqual(start, -1, "The guide is missing the fixture start marker.");
  const contentStart = start + START.length;
  const end = guide.indexOf(END, contentStart);
  assert.notEqual(end, -1, "The guide is missing the fixture end marker.");
  assert.equal(`${guide.slice(contentStart, end).trimEnd()}\n`, fixture);
});
