import assert from "node:assert/strict";
import test from "node:test";

import {
  createReleaseGateReport,
  serializeReleaseGateReport,
  type AcceptanceCheckInput,
} from "./release-gate.ts";

const sourceCommit = "0123456789abcdef0123456789abcdef01234567";
const generatedAt = "2026-08-06T13:40:00.000Z";

function check(overrides: Partial<AcceptanceCheckInput> = {}): AcceptanceCheckInput {
  return {
    id: "repository-checks",
    title: "Repository checks",
    outcome: "PASS",
    severity: "critical",
    ...overrides,
  };
}

test("produces deterministic machine-readable PASS output", () => {
  const report = createReleaseGateReport({
    release: "v0.1.0-alpha.1",
    sourceCommit,
    generatedAt,
    checks: [
      check({
        id: "x86-runtime",
        title: "x86 runtime qualification",
        outcome: "NOT_TRIGGERED",
        severity: "high",
        conditional: true,
      }),
      check(),
    ],
  });

  assert.equal(report.overall, "PASS");
  assert.equal(report.releaseReady, true);
  assert.deepEqual(report.counts, { passed: 1, failed: 0, notTriggered: 1 });
  assert.deepEqual(
    report.checks.map(({ id }) => id),
    ["repository-checks", "x86-runtime"],
  );
  assert.deepEqual(report.blockers, []);
  assert.equal(serializeReleaseGateReport(report), `${JSON.stringify(report, null, 2)}\n`);
});

test("fails the release and reports critical and high blockers", () => {
  const report = createReleaseGateReport({
    release: "v1.0.0",
    sourceCommit,
    generatedAt,
    checks: [
      check({ outcome: "FAIL", details: "pnpm check failed" }),
      check({
        id: "arm64-device",
        title: "ARM64 exact-byte device acceptance",
        outcome: "FAIL",
        severity: "high",
        evidence: ["logcat.txt"],
      }),
      check({
        id: "release-notes",
        title: "Release notes reviewed",
        outcome: "FAIL",
        severity: "standard",
      }),
    ],
  });

  assert.equal(report.overall, "FAIL");
  assert.equal(report.releaseReady, false);
  assert.equal(report.counts.failed, 3);
  assert.deepEqual(report.blockers, [
    {
      id: "arm64-device",
      severity: "high",
      title: "ARM64 exact-byte device acceptance",
    },
    {
      id: "repository-checks",
      severity: "critical",
      title: "Repository checks",
    },
  ]);
});

test("rejects inconclusive or untriggered unconditional checks", () => {
  assert.throws(
    () =>
      createReleaseGateReport({
        release: "v1.0.0",
        sourceCommit,
        generatedAt,
        checks: [check({ outcome: "INCONCLUSIVE" as never })],
      }),
    /outcome is not supported/,
  );

  assert.throws(
    () =>
      createReleaseGateReport({
        release: "v1.0.0",
        sourceCommit,
        generatedAt,
        checks: [check({ outcome: "NOT_TRIGGERED" })],
      }),
    /only when it is explicitly conditional/,
  );
});

test("rejects duplicate IDs and invalid source commits", () => {
  assert.throws(
    () =>
      createReleaseGateReport({
        release: "v1.0.0",
        sourceCommit,
        generatedAt,
        checks: [check(), check()],
      }),
    /duplicate check.id/,
  );

  assert.throws(
    () =>
      createReleaseGateReport({
        release: "v1.0.0",
        sourceCommit: "main",
        generatedAt,
        checks: [check()],
      }),
    /40-character lowercase SHA/,
  );
});
