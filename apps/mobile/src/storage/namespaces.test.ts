import assert from "node:assert/strict";
import test from "node:test";

import {
  DIAGNOSTIC_APP_ID_PREFIX,
  isDiagnosticAppId,
  isPreviewStorageId,
  PREVIEW_STORAGE_PREFIX,
} from "./namespaces.ts";

test("recognizes only reserved preview namespaces", () => {
  assert.equal(isPreviewStorageId(`${PREVIEW_STORAGE_PREFIX}abc`), true);
  assert.equal(isPreviewStorageId("preview-abc"), false);
});

test("recognizes only reserved lifecycle diagnostic app IDs", () => {
  assert.equal(isDiagnosticAppId(`${DIAGNOSTIC_APP_ID_PREFIX}abc-recovery`), true);
  assert.equal(isDiagnosticAppId("lifecycle-helper"), false);
});
