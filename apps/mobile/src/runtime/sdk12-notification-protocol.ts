import type { RuntimeOperation, RuntimeSuccess } from "../model.ts";
import { assertNotificationId, parseNotificationRequestShape } from "./notification-validation.ts";
import { MiniAppRuntimeError, parseDormantSdk12RuntimeResponse } from "./protocol.ts";

interface BaseOperationMarker {
  readonly kind: "base";
}

interface NotificationOperationMarker {
  readonly kind: "notification";
  readonly operation: RuntimeOperation;
}

type OperationMarker = BaseOperationMarker | NotificationOperationMarker;

export function parseDormantSdk12NotificationRuntimeResponse(json: string): RuntimeSuccess {
  let raw: unknown;
  try {
    raw = JSON.parse(json) as unknown;
  } catch {
    return parseDormantSdk12RuntimeResponse(json);
  }

  if (!isRecord(raw) || !isRecord(raw.value) || !Array.isArray(raw.value.operations)) {
    return parseDormantSdk12RuntimeResponse(json);
  }

  const baseOperations: unknown[] = [];
  const markers: OperationMarker[] = [];
  for (const [index, entry] of raw.value.operations.entries()) {
    const notification = parseNotificationOperation(entry, `operations[${index}]`);
    if (notification === null) {
      baseOperations.push(entry);
      markers.push({ kind: "base" });
    } else {
      markers.push({ kind: "notification", operation: notification });
    }
  }

  const delegatedJson = JSON.stringify({
    ...raw,
    value: {
      ...raw.value,
      operations: baseOperations,
    },
  });
  const parsed = parseDormantSdk12RuntimeResponse(delegatedJson);
  let baseIndex = 0;
  const operations = markers.map((marker) => {
    if (marker.kind === "notification") return marker.operation;
    const operation = parsed.value.operations[baseIndex];
    if (operation === undefined) {
      throw invalidNative("The native sandbox returned an inconsistent operation list.");
    }
    baseIndex += 1;
    return operation;
  });
  if (baseIndex !== parsed.value.operations.length) {
    throw invalidNative("The native sandbox returned an inconsistent operation list.");
  }

  return {
    ...parsed,
    value: {
      ...parsed.value,
      operations,
    },
  };
}

function parseNotificationOperation(value: unknown, path: string): RuntimeOperation | null {
  if (!isRecord(value) || typeof value.type !== "string") return null;
  if (value.type === "notification-schedule") {
    exactKeys(value, ["type", "request"], path);
    try {
      return {
        type: "notification-schedule",
        request: parseNotificationRequestShape(value.request, `${path}.request`),
      };
    } catch (cause) {
      throw invalidNative(errorMessage(cause));
    }
  }
  if (value.type === "notification-cancel") {
    exactKeys(value, ["type", "notificationId"], path);
    try {
      return {
        type: "notification-cancel",
        notificationId: assertNotificationId(value.notificationId, `${path}.notificationId`),
      };
    } catch (cause) {
      throw invalidNative(errorMessage(cause));
    }
  }
  if (value.type === "notification-cancel-all") {
    exactKeys(value, ["type"], path);
    return { type: "notification-cancel-all" };
  }
  return null;
}

function exactKeys(
  object: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
): void {
  const allowedKeys = new Set(allowed);
  for (const key of allowed) {
    if (!Object.prototype.hasOwnProperty.call(object, key)) {
      throw invalidNative(`${path}.${key} is required.`);
    }
  }
  for (const key of Object.keys(object)) {
    if (!allowedKeys.has(key)) throw invalidNative(`${path}.${key} is not supported.`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function errorMessage(caught: unknown): string {
  return caught instanceof Error ? caught.message : String(caught);
}

function invalidNative(message: string): MiniAppRuntimeError {
  return new MiniAppRuntimeError("INVALID_NATIVE_RESPONSE", message);
}
