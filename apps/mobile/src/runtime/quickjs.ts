import { runInQuickJs } from "@pocket-tools/quickjs-runtime";

import type { MiniAppInspection, RuntimeSnapshot, RuntimeSuccess } from "../model";
import { MiniAppRuntimeError, parseRuntimeResponse } from "./protocol";

export async function inspectMiniApp(source: string): Promise<MiniAppInspection> {
  const response = await execute(source, {
    mode: "inspect",
    now: new Date().toISOString(),
    settings: {},
    records: {},
    timers: {},
  });
  const inspection = response.value.inspection;
  if (inspection === undefined) {
    throw new Error("QuickJS did not return a mini-app inspection.");
  }
  return inspection;
}

export function renderMiniApp(source: string, snapshot: RuntimeSnapshot): Promise<RuntimeSuccess> {
  return execute(source, snapshot);
}

export function invokeMiniAppAction(
  source: string,
  snapshot: RuntimeSnapshot,
): Promise<RuntimeSuccess> {
  return execute(source, snapshot);
}

export function formatMiniAppError(caught: unknown): string {
  if (caught instanceof MiniAppRuntimeError) {
    const lines = [`${caught.code}: ${caught.message}`];
    if (caught.scriptStack !== undefined && caught.scriptStack.length > 0) {
      lines.push(caught.scriptStack);
    }
    if (caught.logs.length > 0) {
      lines.push(
        "Console output:",
        ...caught.logs.map((entry) => `[${entry.level}] ${entry.message}`),
      );
    }
    if (caught.logsTruncated) lines.push("Console output was truncated.");
    return lines.join("\n");
  }
  return caught instanceof Error ? caught.message : String(caught);
}

async function execute(source: string, snapshot: RuntimeSnapshot): Promise<RuntimeSuccess> {
  const json = await runInQuickJs(source, JSON.stringify(snapshot));
  return parseRuntimeResponse(json);
}
