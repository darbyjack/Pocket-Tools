import type { RuntimeSuccess } from "../model.ts";
import { parseRuntimeResponse } from "./protocol.ts";

/** @deprecated SDK 1.2 notification operations are parsed by parseRuntimeResponse. */
export function parseDormantSdk12NotificationRuntimeResponse(json: string): RuntimeSuccess {
  return parseRuntimeResponse(json);
}
