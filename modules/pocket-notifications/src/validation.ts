import type {
  NativeNotificationOpenTarget,
  NativeNotificationReconciliationResult,
  NativeNotificationResultStatus,
} from "./index.ts";

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
  const target = requireObject(value, "route");
  exactKeys(target, ["hostId", "storageId", "notificationId"], ["screen", "input"], "route");
  return {
    hostId: requireText(target.hostId, "route.hostId"),
    storageId: requireText(target.storageId, "route.storageId"),
    notificationId: requireText(target.notificationId, "route.notificationId"),
    ...(target.screen === undefined
      ? {}
      : { screen: requireText(target.screen, "route.screen") }),
    ...(target.input === undefined ? {} : { input: target.input }),
  };
}

function parseResult(value: unknown, index: number): NativeNotificationReconciliationResult {
  const path = `results[${index}]`;
  const result = requireObject(value, path);
  exactKeys(
    result,
    ["hostId", "storageId", "notificationId", "status"],
    ["platformId", "message"],
    path,
  );
  if (typeof result.status !== "string" || !RESULT_STATUSES.has(result.status as NativeNotificationResultStatus)) {
    throw new Error(`NOTIFICATION_RECONCILIATION_FAILED: ${path}.status is unsupported.`);
  }
  return {
    hostId: requireText(result.hostId, `${path}.hostId`),
    storageId: requireText(result.storageId, `${path}.storageId`),
    notificationId: requireText(result.notificationId, `${path}.notificationId`),
    status: result.status as NativeNotificationResultStatus,
    ...(result.platformId === undefined
      ? {}
      : { platformId: requireText(result.platformId, `${path}.platformId`) }),
    ...(result.message === undefined
      ? {}
      : { message: requireText(result.message, `${path}.message`) }),
  };
}

function requireObject(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`NOTIFICATION_RECONCILIATION_FAILED: ${path} must be a plain object.`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error(`NOTIFICATION_RECONCILIATION_FAILED: ${path} must be a plain object.`);
  }
  return value as Record<string, unknown>;
}

function requireText(value: unknown, path: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`NOTIFICATION_RECONCILIATION_FAILED: ${path} must be non-empty text.`);
  }
  return value;
}

function exactKeys(
  object: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[],
  path: string,
): void {
  const allowed = new Set([...required, ...optional]);
  for (const key of required) {
    if (!(key in object)) {
      throw new Error(`NOTIFICATION_RECONCILIATION_FAILED: ${path}.${key} is required.`);
    }
  }
  for (const key of Object.keys(object)) {
    if (!allowed.has(key)) {
      throw new Error(`NOTIFICATION_RECONCILIATION_FAILED: ${path}.${key} is not supported.`);
    }
  }
}
