import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { AuthoringValidationError, inspectMiniAppSource } from "./inspection.ts";
import { AuthoringRuntimeError } from "./quickjs.ts";
import { AuthoringTypecheckError } from "./typecheck.ts";

const TEMPLATE_URL = new URL("../../../docs/fixtures/agent-template.miniapp.js", import.meta.url);

test("inspects the canonical SDK 1.2 template through the embedded runner", async () => {
  const source = await readFile(TEMPLATE_URL, "utf8");
  const inspection = await inspectMiniAppSource(source);
  assert.equal(inspection.manifest.id, "replace-with-tool-id");
  assert.equal(inspection.manifest.sdkVersion, "1.2");
  assert.deepEqual(inspection.screens, ["home"]);
  assert.deepEqual(Object.keys(inspection.settings), ["message"]);
});

test("rejects imports outside the virtual SDK", async () => {
  const source = `
import "node:fs";
import { defineMiniApp, ui } from "@pocket-tools/sdk";
export default defineMiniApp({
  manifest: { id: "bad-import", name: "Bad Import", sdkVersion: "1.1" },
  screens: { home() { return ui.page({ title: "Bad", children: [] }); } },
});
`;

  await assert.rejects(
    inspectMiniAppSource(source),
    (error: unknown) =>
      error instanceof AuthoringRuntimeError && error.code === "UNSUPPORTED_MODULE",
  );
});

test("returns canonical validation paths for invalid definitions", async () => {
  const source = `
import { defineMiniApp, setting, ui } from "@pocket-tools/sdk";
export default defineMiniApp({
  manifest: { id: "invalid-setting", name: "Invalid Setting", sdkVersion: "1.1" },
  settings: { title: setting.text({ label: "Title", default: "too long", maxLength: 2 }) },
  screens: { home() { return ui.page({ title: "Invalid", children: [] }); } },
});
`;

  await assert.rejects(
    inspectMiniAppSource(source),
    (error: unknown) =>
      error instanceof AuthoringValidationError &&
      error.issues.some((issue) => issue.path === "settings.title.default"),
  );
});

test("rejects invented SDK builders in unrendered screens", async () => {
  const source = `
import { defineMiniApp, ui } from "@pocket-tools/sdk";
export default defineMiniApp({
  manifest: { id: "invented-ui", name: "Invented UI", sdkVersion: "1.1" },
  screens: {
    home() { return ui.page({ title: "Home", children: [] }); },
    future() { return ui.table({ rows: [] }); },
  },
});
`;

  await assert.rejects(
    inspectMiniAppSource(source),
    (error: unknown) =>
      error instanceof AuthoringTypecheckError &&
      error.issues.some((issue) => issue.message.includes("Property 'table'")),
  );
});
