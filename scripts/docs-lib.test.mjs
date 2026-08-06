import assert from "node:assert/strict";
import test from "node:test";

import {
  assertDocumentationMap,
  extractTitle,
  removeMarkdownSection,
  renderFrontmatter,
  rewriteLinkDestination,
  sha256,
  slugifyHeading,
} from "./docs-lib.mjs";
import { pages, sitePath } from "../apps/docs/docs-map.mjs";

test("the documentation map has unique canonical routes and sources", () => {
  assert.doesNotThrow(() => assertDocumentationMap());
});

test("extracts the canonical H1 and preserves the remaining body", () => {
  assert.deepEqual(extractTitle("# Example\n\nIntro.\n\n## Details\n\nBody.", "Fallback"), {
    title: "Example",
    body: "Intro.\n\n## Details\n\nBody.",
  });
});

test("removes one generated landing-page replacement section", () => {
  assert.equal(
    removeMarkdownSection(
      "Intro\n\n## Start here\n\nOld table\n\n## How it works\n\nBody",
      "Start here",
    ),
    "Intro\n\n## How it works\n\nBody",
  );
});

test("rewrites mapped documentation links with the repository base", () => {
  assert.equal(
    rewriteLinkDestination("CONTRIBUTING.md", "docs/README.md"),
    sitePath("documentation"),
  );
  assert.equal(
    rewriteLinkDestination("apps/mobile/README.md", "../../docs/ARCHITECTURE.md"),
    sitePath("architecture"),
  );
});

test("keeps intentionally non-site contributor guidance on GitHub", () => {
  assert.equal(
    rewriteLinkDestination("CONTRIBUTING.md", "AGENTS.md"),
    "https://github.com/darbyjack/Pocket-Tools/blob/main/AGENTS.md",
  );
});

test("uses stable heading slugs and hashes", () => {
  assert.equal(slugifyHeading("SDK 1.2 — Data & Settings"), "sdk-12-data-settings");
  assert.equal(
    sha256("Pocket Tools"),
    "f53c072645ca5ebf738157fdf0f00d3215ffb28c528362a8f1012f418ff20734",
  );
});

test("renders required Starlight frontmatter", () => {
  const page = pages.find((candidate) => candidate.slug === "install");
  const frontmatter = renderFrontmatter(
    page,
    page.title,
    "https://github.com/darbyjack/Pocket-Tools/edit/main/docs/INSTALLATION.md",
  );
  assert.match(frontmatter, /^---\ntitle: "Install Pocket Tools"/);
  assert.match(frontmatter, /description:/);
  assert.match(frontmatter, /editUrl:/);
  assert.match(frontmatter, /sidebar:\n  order: 20/);
});
