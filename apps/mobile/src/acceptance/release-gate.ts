export const RELEASE_GATE_SCHEMA_VERSION = 1;

export const ACCEPTANCE_OUTCOMES = ["PASS", "FAIL", "NOT_TRIGGERED"] as const;
export const RELEASE_BLOCKER_SEVERITIES = ["critical", "high", "standard"] as const;

export type AcceptanceOutcome = (typeof ACCEPTANCE_OUTCOMES)[number];
export type ReleaseBlockerSeverity = (typeof RELEASE_BLOCKER_SEVERITIES)[number];

export interface AcceptanceCheckInput {
  readonly id: string;
  readonly title: string;
  readonly outcome: AcceptanceOutcome;
  readonly severity: ReleaseBlockerSeverity;
  readonly conditional?: boolean;
  readonly details?: string;
  readonly evidence?: readonly string[];
}

export interface ReleaseGateReportInput {
  readonly release: string;
  readonly sourceCommit: string;
  readonly generatedAt: string;
  readonly checks: readonly AcceptanceCheckInput[];
}

export interface ReleaseGateCheck {
  readonly id: string;
  readonly title: string;
  readonly outcome: AcceptanceOutcome;
  readonly severity: ReleaseBlockerSeverity;
  readonly conditional: boolean;
  readonly details?: string;
  readonly evidence: readonly string[];
}

export interface ReleaseGateCounts {
  readonly passed: number;
  readonly failed: number;
  readonly notTriggered: number;
}

export interface ReleaseGateBlocker {
  readonly id: string;
  readonly severity: Exclude<ReleaseBlockerSeverity, "standard">;
  readonly title: string;
}

export interface ReleaseGateReport {
  readonly schemaVersion: typeof RELEASE_GATE_SCHEMA_VERSION;
  readonly release: string;
  readonly sourceCommit: string;
  readonly generatedAt: string;
  readonly overall: "PASS" | "FAIL";
  readonly releaseReady: boolean;
  readonly counts: ReleaseGateCounts;
  readonly blockers: readonly ReleaseGateBlocker[];
  readonly checks: readonly ReleaseGateCheck[];
}

const CHECK_ID_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const COMMIT_PATTERN = /^[0-9a-f]{40}$/;

export function createReleaseGateReport(input: ReleaseGateReportInput): ReleaseGateReport {
  const release = requireText(input.release, "release");
  const sourceCommit = requireText(input.sourceCommit, "sourceCommit");
  if (!COMMIT_PATTERN.test(sourceCommit)) {
    throw new Error("RELEASE_GATE_INVALID: sourceCommit must be a 40-character lowercase SHA.");
  }

  const generatedAt = requireText(input.generatedAt, "generatedAt");
  if (!Number.isFinite(Date.parse(generatedAt))) {
    throw new Error("RELEASE_GATE_INVALID: generatedAt must be an ISO-compatible timestamp.");
  }
  if (input.checks.length === 0) {
    throw new Error("RELEASE_GATE_INVALID: at least one acceptance check is required.");
  }

  const ids = new Set<string>();
  const checks = input.checks.map((check) => normalizeCheck(check, ids)).sort(compareChecks);
  const counts = countOutcomes(checks);
  const blockers = checks
    .filter(
      (check): check is ReleaseGateCheck & {
        readonly severity: ReleaseGateBlocker["severity"];
      } => check.outcome === "FAIL" && check.severity !== "standard",
    )
    .map((check) => ({ id: check.id, severity: check.severity, title: check.title }));
  const overall = counts.failed === 0 ? "PASS" : "FAIL";

  return {
    schemaVersion: RELEASE_GATE_SCHEMA_VERSION,
    release,
    sourceCommit,
    generatedAt,
    overall,
    releaseReady: overall === "PASS",
    counts,
    blockers,
    checks,
  };
}

export function serializeReleaseGateReport(report: ReleaseGateReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}

function normalizeCheck(check: AcceptanceCheckInput, ids: Set<string>): ReleaseGateCheck {
  const id = requireText(check.id, "check.id");
  if (!CHECK_ID_PATTERN.test(id)) {
    throw new Error(
      `RELEASE_GATE_INVALID: check.id ${JSON.stringify(id)} must be lowercase kebab-case.`,
    );
  }
  if (ids.has(id)) {
    throw new Error(`RELEASE_GATE_INVALID: duplicate check.id ${id}.`);
  }
  ids.add(id);

  const title = requireText(check.title, `${id}.title`);
  if (!(ACCEPTANCE_OUTCOMES as readonly string[]).includes(check.outcome)) {
    throw new Error(`RELEASE_GATE_INVALID: ${id}.outcome is not supported.`);
  }
  if (!(RELEASE_BLOCKER_SEVERITIES as readonly string[]).includes(check.severity)) {
    throw new Error(`RELEASE_GATE_INVALID: ${id}.severity is not supported.`);
  }

  const conditional = check.conditional === true;
  if (check.outcome === "NOT_TRIGGERED" && !conditional) {
    throw new Error(
      `RELEASE_GATE_INVALID: ${id} may be NOT_TRIGGERED only when it is explicitly conditional.`,
    );
  }

  return {
    id,
    title,
    outcome: check.outcome,
    severity: check.severity,
    conditional,
    ...(check.details === undefined
      ? {}
      : { details: requireText(check.details, `${id}.details`) }),
    evidence: [...(check.evidence ?? [])].map((entry, index) =>
      requireText(entry, `${id}.evidence[${index}]`),
    ),
  };
}

function countOutcomes(checks: readonly ReleaseGateCheck[]): ReleaseGateCounts {
  let passed = 0;
  let failed = 0;
  let notTriggered = 0;
  for (const check of checks) {
    if (check.outcome === "PASS") passed += 1;
    else if (check.outcome === "FAIL") failed += 1;
    else notTriggered += 1;
  }
  return { passed, failed, notTriggered };
}

function compareChecks(left: ReleaseGateCheck, right: ReleaseGateCheck): number {
  return left.id.localeCompare(right.id);
}

function requireText(value: string, path: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new Error(`RELEASE_GATE_INVALID: ${path} must not be empty.`);
  }
  return normalized;
}
