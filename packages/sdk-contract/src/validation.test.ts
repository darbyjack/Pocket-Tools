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
      version: 1,
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

test("rejects capabilities reserved for a later SDK", () => {
  const definition = {
    ...validDefinition(),
    manifest: {
      ...validDefinition().manifest,
      permissions: [
        {
          capability: "network" as const,
          reason: "Read a remote account balance.",
          allowedHosts: ["api.example.com"],
        },
      ],
    },
  };

  assert.ok(
    validateMiniAppDefinition(definition).some(
      (issue) =>
        issue.path === "manifest.permissions[0].capability" &&
        issue.message.includes("later SDK"),
    ),
  );
});

test("rejects indexes that reference unknown fields", () => {
  const definition = {
    ...validDefinition(),
    collections: {
      entries: {
        fields: {
          value: { type: "number" as const },
        },
        indexes: [{ fields: ["missing"] }],
      },
    },
  };

  assert.ok(
    validateMiniAppDefinition(definition).some((issue) =>
      issue.message.includes("Unknown indexed field"),
    ),
  );
});
