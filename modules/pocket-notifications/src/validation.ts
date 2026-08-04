import type {
  NativeNotificationOpenTarget,
  NativeNotificationReconciliationResult,
  NativeNotificationResultStatus,
} from "./types.ts";

const RESULT_STATUSES = new Set<NativeNotificationResultStatus>([
  "scheduled",
  "blocked",
  "failed",
  "cancelled",
  "delivered",
  "expired",
]);

export function parseNativeNotificationResults(
  json: string,
): readonly NativeNotificationReconciliationResult[] {
  let value: unknown;
  try {
    value = JSON.parse(json) as unknown;
  } catch (cause) {
    throw new Error("NOTIFICATION_RECONCILIATION_FAILED: Native reconciliation returned invalid JSON.", {
      cause,
    });
  }
  if (!Array.isArray(value)) {
    throw new Error("NOTIFICATION_RECONCILIATION_FAILED: Native reconciliation returned invalid data.");
  }
  return value.map((entry, index) => parseResult(entry, index));
}

export function parseNativeNotificationOpenTarget(
  json: string | null,
): NativeNotificationOpenTarget | null {
  if (json === null) return null;
  let value: unknown;
  try {
    value = JSON.parse(json) as unknown;
  } catch (cause) {
    throw new Error("NOTIFICATION_ROUTE_INVALID: Native notification routing JSON is invalid.", {
      cause,
    });
  }
  const target = requireObject(value, "route", "NOTIFICATION_ROUTE_INVALID");
  exactKeys(
    target,
    ["hostId", "storageId", "notificationId"],
    ["screen", "input"],
    "route",
    "NOTIFICATION_ROUTE_INVALID",
  );
  return {
    hostId: requireText(target.hostId, "route.hostId", "NOTIFICATION_ROUTE_INVALID"),
    storageId: requireText(target.storageId, "route.storageId", "NOTIFICATION_ROUTE_INVALID"),
    notificationId: requireText(
      target.notificationId,
      "route.notificationId",
      "NOTIFICATION_ROUTE_INVALID",
    ),
    ...(target.screen === undefined
      ? {}
      : { screen: requireText(target.screen, "route.screen", "NOTIFICATION_ROUTE_INVALID") }),
    ...(target.input === undefined ? {} : { input: target.input }),
  };
}

function parseResult(value: unknown, index: number): NativeNotificationReconciliationResult {
  const path = `results[${index}]`;
  const result = requireObject(value, path, "NOTIFICATION_RECONCILIATION_FAILED");
  exactKeys(
    result,
    ["hostId", "storageId", "notificationId", "status"],
    ["platformId", "message"],
    path,
    "NOTIFICATION_RECONCILIATION_FAILED",
  );
  if (
    typeof result.status !== "string" ||
    !RESULT_STATUSES.has(result.status as NativeNotificationResultStatus)
  ) {
    throw new Error(`NOTIFICATION_RECONCILIATION_FAILED: ${path}.status is unsupported.`);
  }
  return {
    hostId: requireText(result.hostId, `${path}.hostId`, "NOTIFICATION_RECONCILIATION_FAILED"),
    storageId: requireText(
      result.storageId,
      `${path}.storageId`,
      "NOTIFICATION_RECONCILIATION_FAILED",
    ),
    notificationId: requireText(
      result.notificationId,
      `${path}.notificationId`,
      "NOTIFICATION_RECONCILIATION_FAILED",
    ),
    status: result.status as NativeNotificationResultStatus,
    ...(result.platformId === undefined
      ? {}
      : {
          platformId: requireText(
            result.platformId,
            `${path}.platformId`,
            "NOTIFICATION_RECONCILIATION_FAILED",
          ),
        }),
    ...(result.message === undefined
      ? {}
      : {
          message: requireText(
            result.message,
            `${path}.message`,
            "NOTIFICATION_RECONCILIATION_FAILED",
          ),
        }),
  };
}

function requireObject(
  value: unknown,
  path: string,
  code: "NOTIFICATION_RECONCILIATION_FAILED" | "NOTIFICATION_ROUTE_INVALID",
): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${code}: ${path} must be a plain object.`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error(`${code}: ${path} must be a plain object.`);
  }
  return value as Record<string, unknown>;
}

function requireText(
  value: unknown,
  path: string,
  code: "NOTIFICATION_RECONCILIATION_FAILED" | "NOTIFICATION_ROUTE_INVALID",
): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${code}: ${path} must be non-empty text.`);
  }
  return value;
}

function exactKeys(
  object: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[],
  path: string,
  code: "NOTIFICATION_RECONCILIATION_FAILED" | "NOTIFICATION_ROUTE_INVALID",
): void {
  const allowed = new Set([...required, ...optional]);
  for (const key of required) {
    if (!(key in object)) {
      throw new Error(`${code}: ${path}.${key} is required.`);
    }
  }
  for (const key of Object.keys(object)) {
    if (!allowed.has(key)) {
      throw new Error(`${code}: ${path}.${key} is not supported.`);
    }
  }
}
