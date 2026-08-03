import type {
  MetricNode,
  RuntimeLogEntry,
  RuntimeSuccess,
  SettingDefinition,
  TimerSnapshot,
} from "../model.ts";

const LOG_LEVELS = new Set(["log", "info", "warn", "error"]);

export class MiniAppRuntimeError extends Error {
  readonly code: string;
  readonly scriptStack: string | undefined;
  readonly logs: readonly RuntimeLogEntry[];
  readonly logsTruncated: boolean;

  constructor(
    code: string,
    message: string,
    options: {
      readonly scriptStack?: string;
      readonly logs?: readonly RuntimeLogEntry[];
      readonly logsTruncated?: boolean;
      readonly cause?: unknown;
    } = {},
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "MiniAppRuntimeError";
    this.code = code;
    this.scriptStack = options.scriptStack;
    this.logs = options.logs ?? [];
    this.logsTruncated = options.logsTruncated ?? false;
  }
}

export function parseRuntimeResponse(json: string): RuntimeSuccess {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (cause) {
    throw new MiniAppRuntimeError(
      "INVALID_NATIVE_RESPONSE",
      "The native sandbox returned invalid JSON.",
      { cause },
    );
  }

  if (!isRecord(parsed) || typeof parsed.ok !== "boolean") {
    throw new MiniAppRuntimeError(
      "INVALID_NATIVE_RESPONSE",
      "The native sandbox returned an invalid response envelope.",
    );
  }

  const logs = parseLogs(parsed.logs);
  if (typeof parsed.logsTruncated !== "boolean") {
    throw new MiniAppRuntimeError(
      "INVALID_NATIVE_RESPONSE",
      "The native sandbox omitted its log truncation state.",
      { logs },
    );
  }

  if (!parsed.ok) {
    if (
      !isRecord(parsed.error) ||
      typeof parsed.error.code !== "string" ||
      typeof parsed.error.message !== "string" ||
      (parsed.error.stack !== undefined && typeof parsed.error.stack !== "string")
    ) {
      throw new MiniAppRuntimeError(
        "INVALID_NATIVE_RESPONSE",
        "The native sandbox returned an invalid error payload.",
        { logs, logsTruncated: parsed.logsTruncated },
      );
    }
    throw new MiniAppRuntimeError(parsed.error.code, parsed.error.message, {
      ...(parsed.error.stack === undefined
        ? {}
        : { scriptStack: parsed.error.stack }),
      logs,
      logsTruncated: parsed.logsTruncated,
    });
  }

  if (!isRecord(parsed.value) || !Array.isArray(parsed.value.operations)) {
    throw new MiniAppRuntimeError(
      "INVALID_NATIVE_RESPONSE",
      "The native sandbox returned an invalid success payload.",
      { logs, logsTruncated: parsed.logsTruncated },
    );
  }

  return parsed as unknown as RuntimeSuccess;
}

function parseLogs(value: unknown): readonly RuntimeLogEntry[] {
  if (!Array.isArray(value)) {
    throw new MiniAppRuntimeError(
      "INVALID_NATIVE_RESPONSE",
      "The native sandbox returned an invalid log payload.",
    );
  }

  return value.map((entry) => {
    if (
      !isRecord(entry) ||
      typeof entry.level !== "string" ||
      !LOG_LEVELS.has(entry.level) ||
      typeof entry.message !== "string"
    ) {
      throw new MiniAppRuntimeError(
        "INVALID_NATIVE_RESPONSE",
        "The native sandbox returned an invalid log entry.",
      );
    }
    return entry as unknown as RuntimeLogEntry;
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function timerElapsedSeconds(
  timer: TimerSnapshot | undefined,
  nowMilliseconds: number,
): number {
  if (timer === undefined) {
    return 0;
  }
  const startedAt = Date.parse(timer.startedAt);
  if (!Number.isFinite(startedAt)) {
    return Math.max(0, timer.elapsedSeconds);
  }
  return Math.max(timer.elapsedSeconds, (nowMilliseconds - startedAt) / 1_000);
}

export function metricValue(
  node: MetricNode,
  timers: Readonly<Record<string, TimerSnapshot>>,
  nowMilliseconds: number,
): string | number {
  if (node.liveTimer === undefined) {
    return node.value;
  }
  const elapsedSeconds = timerElapsedSeconds(
    timers[node.liveTimer.timerId],
    nowMilliseconds,
  );
  return Number(node.value) + (elapsedSeconds / 3_600) * node.liveTimer.ratePerHour;
}

export function settingIsVisible(
  definition: SettingDefinition,
  values: Readonly<Record<string, unknown>>,
): boolean {
  const rule = definition.visibleWhen;
  return rule === undefined || values[rule.setting] === rule.equals;
}
