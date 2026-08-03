import { runInQuickJs } from "@pocket-tools/quickjs-runtime";

import type {
  MiniAppInspection,
  RuntimeSnapshot,
  RuntimeSuccess,
} from "../model";
import { parseRuntimeResponse } from "./protocol";

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

export function renderMiniApp(
  source: string,
  snapshot: RuntimeSnapshot,
): Promise<RuntimeSuccess> {
  return execute(source, snapshot);
}

export function invokeMiniAppAction(
  source: string,
  snapshot: RuntimeSnapshot,
): Promise<RuntimeSuccess> {
  return execute(source, snapshot);
}

async function execute(
  source: string,
  snapshot: RuntimeSnapshot,
): Promise<RuntimeSuccess> {
  const json = await runInQuickJs(source, JSON.stringify(snapshot));
  return parseRuntimeResponse(json);
}
