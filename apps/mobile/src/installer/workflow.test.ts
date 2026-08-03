import assert from "node:assert/strict";
import test from "node:test";

import { DIAGNOSTIC_APP_ID_PREFIX } from "../storage/namespaces.ts";
import {
  assertCandidateIdentity,
  createPreviewStorageId,
  isCurrentSourceApproved,
} from "./workflow.ts";

test("an update cannot change the permanent manifest ID", () => {
  assert.doesNotThrow(() =>
    assertCandidateIdentity("edit", "daily-tool", "daily-tool"),
  );
  assert.throws(
    () => assertCandidateIdentity("edit", "daily-tool", "other-tool"),
    /cannot change manifest\.id/,
  );
});

test("a duplicate must use a new permanent manifest ID", () => {
  assert.throws(
    () => assertCandidateIdentity("duplicate", "daily-tool", "daily-tool"),
    /duplicate must change manifest\.id/,
  );
  assert.doesNotThrow(() =>
    assertCandidateIdentity("duplicate", "daily-tool", "other-tool"),
  );
});

test("host diagnostic manifest IDs are reserved", () => {
  assert.throws(
    () =>
      assertCandidateIdentity(
        "create",
        null,
        `${DIAGNOSTIC_APP_ID_PREFIX}manual`,
      ),
    /reserved for host diagnostics/,
  );
  assert.doesNotThrow(() =>
    assertCandidateIdentity("create", null, "lifecycle-helper"),
  );
});

test("only the exact inspected and previewed source can be persisted", () => {
  assert.equal(
    isCurrentSourceApproved("source-v2", "source-v2", "source-v2"),
    true,
  );
  assert.equal(
    isCurrentSourceApproved("source-v2", "source-v1", "source-v2"),
    false,
  );
  assert.equal(
    isCurrentSourceApproved("source-v2", "source-v2", "source-v1"),
    false,
  );
  assert.equal(isCurrentSourceApproved("source-v2", null, null), false);
});

test("preview storage IDs are internal and deterministic for supplied entropy", () => {
  const id = createPreviewStorageId(1_700_000_000_000, 0.5);
  assert.match(id, /^__preview__[a-z0-9]+$/);
  assert.equal(id, createPreviewStorageId(1_700_000_000_000, 0.5));
});
