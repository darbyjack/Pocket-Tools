import type {
  MetricNode,
  RuntimeFailure,
  RuntimeResponse,
  RuntimeSuccess,
  SettingDefinition,
  TimerSnapshot,
} from "../model.ts";

export function parseRuntimeResponse(json: string): RuntimeSuccess {
  const parsed = JSON.parse(json) as RuntimeResponse;
  if (!parsed.ok) {
    throw new Error(`${parsed.error.code}: ${parsed.error.message}`);
  }
  return parsed;
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

export function runtimeFailure(message: string): RuntimeFailure {
  return {
    ok: false,
    error: { code: "HOST_ERROR", message },
  };
}
