import assert from "node:assert/strict";
import test from "node:test";

import { defineMiniApp } from "./core.ts";
import { setting } from "./settings.ts";
import { ui } from "./ui.ts";
import { validateMiniAppDefinition } from "./validation.ts";

test("keeps SDK 1.2 manifests disabled while internal slices are incomplete", () => {
  const definition = defineMiniApp({
    manifest: {
      id: "sdk-12-disabled",
      name: "SDK 1.2 Disabled",
      sdkVersion: "1.1",
    },
    settings: {
      draftTitle: setting.text({ label: "Draft title", default: "" }),
    },
    screens: {
      home: () => ui.page({ title: "SDK 1.2 Disabled", children: [] }),
    },
  });

  const sdk12Definition = {
    ...definition,
    manifest: { ...definition.manifest, sdkVersion: "1.2" },
  } as unknown as typeof definition;

  assert.ok(
    validateMiniAppDefinition(sdk12Definition).some(
      (issue) => issue.path === "manifest.sdkVersion",
    ),
  );
});
