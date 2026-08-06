import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));

test("keeps Git and Oxfmt aligned on LF line endings", async () => {
  const attributes = await readFile(resolve(repositoryRoot, ".gitattributes"), "utf8");
  const formatter = JSON.parse(
    await readFile(resolve(repositoryRoot, ".oxfmtrc.json"), "utf8"),
  );

  assert.match(attributes, /^\* text=auto eol=lf$/m);
  assert.equal(formatter.endOfLine, "lf");
});
