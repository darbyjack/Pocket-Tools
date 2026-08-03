import assert from "node:assert/strict";
import test from "node:test";

import { setting } from "@pocket-tools/sdk-contract";

import type { MiniAppInspection } from "../model.ts";
import { validatePageNode } from "./ui-validation.ts";

const inspection: MiniAppInspection = {
  manifest: { id: "example-tool", name: "Example Tool", sdkVersion: 1 },
  settings: {
    title: setting.text({ label: "Title", default: "Example" }),
    count: setting.number({ label: "Count", default: 1 }),
    enabled: setting.boolean({ label: "Enabled", default: true }),
    mode: setting.select({
      label: "Mode",
      default: "one",
      options: [{ label: "One", value: "one" }],
    }),
  },
  collections: {},
  screens: ["home", "details"],
  actions: ["save"],
};

function validPage(): Record<string, unknown> {
  return {
    type: "page",
    title: "Example Tool",
    children: [
      { type: "heading", text: "Editor", level: 2 },
      { type: "text", text: "Update the values below." },
      {
        type: "column",
        children: [
          { type: "text-input", setting: "title", placeholder: "Title" },
          { type: "number-input", setting: "count" },
          { type: "toggle", setting: "enabled" },
          { type: "select", setting: "mode" },
        ],
      },
      {
        type: "row",
        children: [
          { type: "button", label: "Save", action: "save" },
          { type: "navigation", label: "Details", screen: "details" },
        ],
      },
      {
        type: "summary",
        title: "Summary",
        values: [{ label: "Count", value: 1, format: "number" }],
      },
    ],
  };
}

function children(node: Record<string, unknown>): Array<Record<string, unknown>> {
  assert.ok(Array.isArray(node.children));
  return node.children as Array<Record<string, unknown>>;
}

test("accepts every frozen layout, input, action, and navigation node", () => {
  assert.doesNotThrow(() => validatePageNode(validPage(), inspection));
});

test("rejects unknown node properties", () => {
  const page = validPage();
  children(page)[0]!.backgroundColor = "red";
  assert.throws(
    () => validatePageNode(page, inspection),
    /page\.children\[0\]\.backgroundColor: Unknown UI property/,
  );
});

test("rejects unknown action and screen targets", () => {
  const page = validPage();
  const row = children(page)[3]!;
  children(row)[0]!.action = "removeAll";
  assert.throws(() => validatePageNode(page, inspection), /Unknown declared action/);

  const secondPage = validPage();
  const secondRow = children(secondPage)[3]!;
  children(secondRow)[1]!.screen = "missing";
  assert.throws(() => validatePageNode(secondPage, inspection), /Unknown declared screen/);
});

test("rejects missing and incompatible setting bindings", () => {
  const page = validPage();
  const column = children(page)[2]!;
  children(column)[0]!.setting = "missing";
  assert.throws(() => validatePageNode(page, inspection), /Unknown declared setting/);

  const secondPage = validPage();
  const secondColumn = children(secondPage)[2]!;
  children(secondColumn)[1]!.setting = "title";
  assert.throws(() => validatePageNode(secondPage, inspection), /incompatible type text/);
});

test("rejects non-finite formatted values and nested pages", () => {
  const page = validPage();
  const summary = children(page)[4]!;
  const values = summary.values as Array<Record<string, unknown>>;
  values[0]!.value = Number.POSITIVE_INFINITY;
  assert.throws(() => validatePageNode(page, inspection), /Expected a finite number/);

  const nested = validPage();
  children(nested).push({ type: "page", title: "Nested", children: [] });
  assert.throws(() => validatePageNode(nested, inspection), /Page nodes cannot be nested/);
});

test("rejects oversized trees", () => {
  const page = {
    type: "page",
    title: "Too large",
    children: Array.from({ length: 512 }, (_, index) => ({
      type: "text",
      text: `Node ${index}`,
    })),
  };
  assert.throws(() => validatePageNode(page, inspection), /exceeds 512 nodes/);
});
