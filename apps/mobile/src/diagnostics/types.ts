export type DiagnosticStatus = "passed" | "failed" | "pending";

export interface DiagnosticCheck {
  readonly id: string;
  readonly title: string;
  readonly status: DiagnosticStatus;
  readonly detail: string;
}

export interface TimerRecoveryCheckpoint {
  readonly appId: string;
  readonly appName: string;
  readonly source: string;
  readonly startedAt: string;
  readonly preparedAt: string;
  readonly launchId: string;
}
