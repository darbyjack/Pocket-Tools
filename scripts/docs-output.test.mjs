import assert from "node:assert/strict";
import test from "node:test";

import {
  generatedWarningHtml,
  generatedWarningMdx,
  normalizeGeneratedMarkdown,
} from "./docs-output.mjs";

test("converts only the generated source warning to MDX-safe syntax", () => {
  const markdown = `---\ntitle: "Example"\n---\n\n${generatedWarningHtml}\n\n<!-- Canonical content comment. -->\n\nBody.\n`;
  const normalized = normalizeGeneratedMarkdown(markdown);

  assert.match(normalized, new RegExp(escapeRegExp(generatedWarningMdx)));
  assert.doesNotMatch(normalized, new RegExp(escapeRegExp(generatedWarningHtml)));
  assert.match(normalized, /<!-- Canonical content comment\. -->/);
  assert.equal(normalizeGeneratedMarkdown(normalized), normalized);
});

test("rejects generated pages without a source warning", () => {
  assert.throws(
    () => normalizeGeneratedMarkdown("---\ntitle: Missing\n---\n\nBody.\n"),
    /missing its source warning/,
  );
});

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
