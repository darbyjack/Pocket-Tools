import assert from "node:assert/strict";
import test from "node:test";

import { defineMiniApp } from "./core.ts";
import { ui } from "./ui.ts";
import { validateMiniAppDefinition } from "./validation.ts";

function validDefinition() {
  return defineMiniApp({
    manifest: {
      id: "example-tool",
      name: "Example Tool",
      sdkVersion: 1,
    },
    screens: {
      home: () => ui.page({ title: "Example Tool", children: [] }),
    },
  });
}

test("accepts a minimal valid definition", () => {
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

test("rejects an unsupported SDK identifier", () => {
  const definition = {
    ...validDefinition(),
    manifest: {
      ...validDefinition().manifest,
      sdkVersion: 2,
    },
  } as unknown as ReturnType<typeof validDefinition>;

  assert.ok(
    validateMiniAppDefinition(definition).some(
      (issue) => issue.path === "manifest.sdkVersion",
    ),
  );
});

test("rejects empty collection definitions", () => {
  const definition = {
    ...validDefinition(),
    collections: {
      entries: {
        fields: {},
      },
    },
  };

  assert.ok(
    validateMiniAppDefinition(definition).some(
      (issue) => issue.path === "collections.entries.fields",
    ),
  );
});
