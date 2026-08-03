import assert from "node:assert/strict";
import test from "node:test";

import { validatePageNode } from "./ui-validation.ts";

function validPage(): Record<string, unknown> {
  return {
    type: "page",
    title: "Tip Splitter",
    children: [
      {
        type: "section",
        title: "Total",
        children: [
          {
            type: "metric",
            label: "Total with tip",
            value: 120,
            format: "money",
          },
          {
            type: "button",
            label: "Recalculate",
            action: "recalculate",
          },
        ],
      },
      {
        type: "summary",
        title: "Breakdown",
        values: [
          { label: "Bill", value: 100, format: "money" },
          { label: "Tip", value: 20, format: "money" },
        ],
      },
    ],
  };
}

function pageChildren(page: Record<string, unknown>): Array<Record<string, unknown>> {
  assert.ok(Array.isArray(page.children));
  return page.children as Array<Record<string, unknown>>;
}

function sectionChildren(section: Record<string, unknown>): Array<Record<string, unknown>> {
  assert.ok(Array.isArray(section.children));
  return section.children as Array<Record<string, unknown>>;
}

test("accepts a complete current-SDK page", () => {
  assert.doesNotThrow(() => validatePageNode(validPage()));
});

test("rejects unknown node properties", () => {
  const page = validPage();
  const section = pageChildren(page)[0];
  assert.ok(section);
  section.backgroundColor = "red";
  assert.throws(
    () => validatePageNode(page),
    /INVALID_UI_TREE: page\.children\[0\]\.backgroundColor: Unknown UI property/,
  );
});

test("rejects invalid action identifiers", () => {
  const page = validPage();
  const section = pageChildren(page)[0];
  assert.ok(section);
  const button = sectionChildren(section)[1];
  assert.ok(button);
  button.action = "delete everything";
  assert.throws(
    () => validatePageNode(page),
    /Expected a lower camelCase identifier/,
  );
});

test("rejects non-finite display values", () => {
  const page = validPage();
  const section = pageChildren(page)[0];
  assert.ok(section);
  const metric = sectionChildren(section)[0];
  assert.ok(metric);
  metric.value = Number.POSITIVE_INFINITY;
  assert.throws(() => validatePageNode(page), /Expected a finite number/);
});

test("rejects nested page nodes", () => {
  const page = validPage();
  pageChildren(page).push({ type: "page", title: "Nested", children: [] });
  assert.throws(() => validatePageNode(page), /Page nodes cannot be nested/);
});

test("rejects oversized trees", () => {
  const page = {
    type: "page",
    title: "Too large",
    children: Array.from({ length: 512 }, (_, index) => ({
      type: "metric",
      label: `Metric ${index}`,
      value: index,
    })),
  };
  assert.throws(() => validatePageNode(page), /exceeds 512 nodes/);
});
