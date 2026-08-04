import assert from "node:assert/strict";
import test from "node:test";

import { validateDormantSdk12Definition } from "./sdk12-date-definition.ts";

function validate(settings: Record<string, unknown>) {
  return validateDormantSdk12Definition({
    manifest: {
      id: "multi-select-tool",
      name: "Multi-select Tool",
      sdkVersion: "1.2",
    },
    settings,
    collections: {},
    screens: ["home"],
    actions: [],
  });
}

const options = [
  { label: "Work", value: "work" },
  { label: "Personal", value: "personal" },
  { label: "Pinned", value: true },
];

test("normalizes dormant multi-select defaults into declaration order", () => {
  const result = validate({
    tags: {
      type: "multi-select",
      label: "Tags",
      options,
      default: [true, "work"],
      minSelections: 1,
      maxSelections: 3,
    },
  });

  assert.deepEqual(result.issues, []);
  assert.deepEqual(result.inspection?.settings.tags?.default, ["work", true]);
  assert.equal(result.inspection?.settings.tags?.type, "multi-select");
});

test("rejects malformed defaults and selection bounds", () => {
  const cases = [
    { default: "work" },
    { default: ["work", "work"] },
    { default: ["unknown"] },
    { default: [], minSelections: 1 },
    { default: ["work", "personal"], maxSelections: 1 },
    { default: ["work"], minSelections: -1 },
    { default: ["work"], maxSelections: 4 },
    { default: ["work"], minSelections: 2, maxSelections: 1 },
  ];

  for (const overrides of cases) {
    const result = validate({
      tags: {
        type: "multi-select",
        label: "Tags",
        options,
        ...overrides,
      },
    });
    assert.ok(result.issues.length > 0, JSON.stringify(overrides));
    assert.equal(result.inspection, undefined);
  }
});

test("reuses bounded select option validation", () => {
  const result = validate({
    tags: {
      type: "multi-select",
      label: "Tags",
      options: [
        { label: "Work", value: "work" },
        { label: "Duplicate", value: "work" },
      ],
      default: ["work"],
    },
  });

  assert.match(result.issues.map((issue) => issue.message).join("\n"), /unique/);
});

test("rejects visibleWhen references to multi-select settings", () => {
  const result = validate({
    tags: {
      type: "multi-select",
      label: "Tags",
      options,
      default: ["work"],
    },
    notes: {
      type: "text",
      label: "Notes",
      default: "",
      visibleWhen: { setting: "tags", equals: "work" },
    },
  });

  assert.match(
    result.issues.map((issue) => `${issue.path}: ${issue.message}`).join("\n"),
    /Multi-select settings cannot be used for visibility comparisons/,
  );
});
