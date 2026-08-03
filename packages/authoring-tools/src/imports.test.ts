import assert from "node:assert/strict";
import test from "node:test";

import { findImportViolation } from "./imports.ts";

test("allows only the frozen virtual SDK module", () => {
  assert.equal(
    findImportViolation(
      'import { defineMiniApp, ui } from "@pocket-tools/sdk";\nexport default defineMiniApp({});',
    ),
    null,
  );
});

test("rejects static imports and re-exports outside the SDK", () => {
  const imported = findImportViolation('import value from "other-package";');
  assert.equal(imported?.moduleName, "other-package");
  assert.equal(imported?.line, 1);
  assert.equal(imported?.column, 19);

  const exported = findImportViolation('export * from "./other.js";');
  assert.equal(exported?.moduleName, "./other.js");
});

test("rejects dynamic imports even when they target the SDK", () => {
  const violation = findImportViolation('const sdk = await import("@pocket-tools/sdk");');
  assert.equal(violation?.message, "Dynamic imports are unsupported.");
});
