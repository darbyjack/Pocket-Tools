import assert from "node:assert/strict";
import test from "node:test";

import { sanitizeGitleaksFindings } from "./repository-history-audit-review.mjs";

test("sanitized Gitleaks review omits secret and source content", () => {
  const review = sanitizeGitleaksFindings([
    {
      RuleID: "github-pat",
      Description: "GitHub Personal Access Token",
      File: "config/example.txt",
      Commit: "a".repeat(40),
      StartLine: 7,
      EndLine: 7,
      Secret: "should-never-appear",
      Match: "token = should-never-appear",
      Line: "token = should-never-appear",
    },
  ]);

  assert.deepEqual(review, [
    {
      ruleId: "github-pat",
      description: "GitHub Personal Access Token",
      file: "config/example.txt",
      commit: "a".repeat(40),
      startLine: 7,
      endLine: 7,
    },
  ]);
  assert.equal(JSON.stringify(review).includes("should-never-appear"), false);
});

test("sanitized Gitleaks review rejects non-array reports", () => {
  assert.throws(() => sanitizeGitleaksFindings({}), /report must be an array/);
});
