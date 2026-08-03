import assert from "node:assert/strict";
import test from "node:test";

import { collection, field } from "./data.ts";
import { defineMiniApp } from "./core.ts";
import { setting } from "./settings.ts";
import { ui } from "./ui.ts";
import { validateMiniAppDefinition } from "./validation.ts";

function validDefinition() {
  return defineMiniApp({
    manifest: {
      id: "example-tool",
      name: "Example Tool",
      sdkVersion: 1,
    },
    settings: {
      title: setting.text({ label: "Title", default: "Example", maxLength: 80 }),
      enabled: setting.boolean({ label: "Enabled", default: true }),
      count: setting.number({ label: "Count", default: 1, min: 0, max: 10 }),
      budget: setting.money({ label: "Budget", default: 25, min: 0 }),
      mode: setting.select({
        label: "Mode",
        default: "simple",
        options: [
          { label: "Simple", value: "simple" },
          { label: "Advanced", value: "advanced" },
        ],
      }),
    },
    collections: {
      entries: collection({
        title: field.text({ maxLength: 200 }),
        complete: field.boolean(),
        amount: field.money({ optional: true, min: 0 }),
        createdFor: field.datetime(),
      }),
    },
    screens: {
      home: () => ui.page({ title: "Example Tool", children: [] }),
      details: () => ui.page({ title: "Details", children: [] }),
    },
    actions: {
      save() {},
    },
  });
}

test("accepts the complete frozen SDK v1 definition surface", () => {
  assert.deepEqual(validateMiniAppDefinition(validDefinition()), []);
});

test("requires a kebab-case id and home screen", () => {
  const definition = {
    ...validDefinition(),
    manifest: { ...validDefinition().manifest, id: "Bad Id" },
    screens: {},
  };
  const paths = validateMiniAppDefinition(definition).map((issue) => issue.path);
  assert.ok(paths.includes("manifest.id"));
  assert.ok(paths.includes("screens"));
  assert.ok(paths.includes("screens.home"));
});

test("rejects unknown properties and unsupported SDK versions", () => {
  const definition = {
    ...validDefinition(),
    futureFeature: true,
    manifest: { ...validDefinition().manifest, sdkVersion: 2 },
  } as unknown as ReturnType<typeof validDefinition>;
  const paths = validateMiniAppDefinition(definition).map((issue) => issue.path);
  assert.ok(paths.includes("definition.futureFeature"));
  assert.ok(paths.includes("manifest.sdkVersion"));
});

test("validates setting defaults, bounds, visibility, and select options", () => {
  const definition = {
    ...validDefinition(),
    settings: {
      badText: setting.text({ label: "Text", default: "too long", maxLength: 2 }),
      badNumber: setting.number({ label: "Number", default: 20, min: 0, max: 10 }),
      badSelect: setting.select({
        label: "Select",
        default: "missing",
        options: [{ label: "One", value: "one" }],
      }),
      dependent: setting.boolean({
        label: "Dependent",
        default: true,
        visibleWhen: { setting: "unknown", equals: true },
      }),
    },
  };
  const paths = validateMiniAppDefinition(definition).map((issue) => issue.path);
  assert.ok(paths.includes("settings.badText.default"));
  assert.ok(paths.includes("settings.badNumber.default"));
  assert.ok(paths.includes("settings.badSelect.default"));
  assert.ok(paths.includes("settings.dependent.visibleWhen.setting"));
});

test("validates collection fields and optional metadata", () => {
  const definition = {
    ...validDefinition(),
    collections: {
      empty: { fields: {} },
      invalid: {
        fields: {
          title: { type: "text", optional: "yes", minLength: 10, maxLength: 2 },
          mystery: { type: "unknown" },
        },
      },
    },
  } as unknown as ReturnType<typeof validDefinition>;
  const paths = validateMiniAppDefinition(definition).map((issue) => issue.path);
  assert.ok(paths.includes("collections.empty.fields"));
  assert.ok(paths.includes("collections.invalid.fields.title.optional"));
  assert.ok(paths.includes("collections.invalid.fields.title"));
  assert.ok(paths.includes("collections.invalid.fields.mystery.type"));
});
