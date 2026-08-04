import { isSerializableValue } from "@pocket-tools/sdk-contract";

import type {
  MiniAppInspection,
  NotificationDelivery,
  NotificationRequest,
  NotificationTrigger,
} from "../model.ts";
import { isCanonicalDateTime } from "./date-values.ts";

const IDENTIFIER_PATTERN = /^[a-z][A-Za-z0-9]*$/;

export interface NotificationValidationOptions {
  readonly now?: string;
  readonly requireFutureDate?: boolean;
}

export function assertNotificationId(value: unknown, path: string): string {
  if (typeof value !== "string" || !IDENTIFIER_PATTERN.test(value)) {
    throw validationError(`${path} must be a lower camelCase identifier.`);
  }
  if (Array.from(value).length > 80) {
    throw validationError(`${path} must contain at most 80 characters.`);
  }
  return value;
}

export function parseNotificationRequestShape(
  value: unknown,
  path: string,
): NotificationRequest {
  return normalizeRequest(value, undefined, path, {});
}

export function normalizeNotificationRequest(
  value: unknown,
  inspection: MiniAppInspection,
  path: string,
  options: NotificationValidationOptions = {},
): NotificationRequest {
  return normalizeRequest(value, inspection, path, options);
}

export function notificationUsesExactDelivery(request: NotificationRequest): boolean {
  return request.trigger.type !== "immediate" && request.trigger.delivery === "exact";
}

function normalizeRequest(
  value: unknown,
  inspection: MiniAppInspection | undefined,
  path: string,
  options: NotificationValidationOptions,
): NotificationRequest {
  const request = requireObject(value, path);
  exactKeys(request, ["id", "title", "trigger"], ["body", "open"], path);

  const id = assertNotificationId(request.id, `${path}.id`);
  const title = requireText(request.title, `${path}.title`, 1, 80);
  const body =
    request.body === undefined ? undefined : requireText(request.body, `${path}.body`, 0, 240);
  const trigger = normalizeTrigger(request.trigger, `${path}.trigger`, options);
  const open =
    request.open === undefined
      ? undefined
      : normalizeOpenTarget(request.open, inspection, `${path}.open`);

  return {
    id,
    title,
    ...(body === undefined ? {} : { body }),
    trigger,
    ...(open === undefined ? {} : { open }),
  };
}

function normalizeTrigger(
  value: unknown,
  path: string,
  options: NotificationValidationOptions,
): NotificationTrigger {
  const trigger = requireObject(value, path);
  if (trigger.type === "immediate") {
    exactKeys(trigger, ["type"], [], path);
    return { type: "immediate" };
  }

  if (trigger.type === "date") {
    exactKeys(trigger, ["type", "at"], ["delivery"], path);
    if (!isCanonicalDateTime(trigger.at)) {
      throw validationError(`${path}.at must be a canonical UTC date-time.`);
    }
    if (options.requireFutureDate === true) {
      const now = options.now;
      if (!isCanonicalDateTime(now)) {
        throw validationError(`${path}.at cannot be validated without a canonical action time.`);
      }
      if (Date.parse(trigger.at) <= Date.parse(now)) {
        throw validationError(`${path}.at must be in the future.`);
      }
    }
    return {
      type: "date",
      at: trigger.at,
      delivery: normalizeDelivery(trigger.delivery, `${path}.delivery`),
    };
  }

  if (trigger.type === "daily") {
    exactKeys(trigger, ["type", "hour", "minute"], ["delivery"], path);
    return {
      type: "daily",
      hour: requireInteger(trigger.hour, `${path}.hour`, 0, 23),
      minute: requireInteger(trigger.minute, `${path}.minute`, 0, 59),
      delivery: normalizeDelivery(trigger.delivery, `${path}.delivery`),
    };
  }

  if (trigger.type === "weekly") {
    exactKeys(trigger, ["type", "weekday", "hour", "minute"], ["delivery"], path);
    const weekday = requireInteger(trigger.weekday, `${path}.weekday`, 1, 7);
    return {
      type: "weekly",
      weekday: weekday as 1 | 2 | 3 | 4 | 5 | 6 | 7,
      hour: requireInteger(trigger.hour, `${path}.hour`, 0, 23),
      minute: requireInteger(trigger.minute, `${path}.minute`, 0, 59),
      delivery: normalizeDelivery(trigger.delivery, `${path}.delivery`),
    };
  }

  throw validationError(`${path}.type is unsupported.`);
}

function normalizeOpenTarget(
  value: unknown,
  inspection: MiniAppInspection | undefined,
  path: string,
): NotificationRequest["open"] {
  const open = requireObject(value, path);
  exactKeys(open, ["screen"], ["input"], path);
  if (typeof open.screen !== "string" || !IDENTIFIER_PATTERN.test(open.screen)) {
    throw validationError(`${path}.screen must be a lower camelCase identifier.`);
  }
  if (inspection !== undefined && !inspection.screens.includes(open.screen)) {
    throw validationError(`${path}.screen must name a declared screen.`);
  }
  if (open.input !== undefined && !isSerializableValue(open.input)) {
    throw validationError(`${path}.input must be finite and serializable.`);
  }
  return {
    screen: open.screen,
    ...(open.input === undefined ? {} : { input: open.input }),
  };
}

function normalizeDelivery(value: unknown, path: string): NotificationDelivery {
  if (value === undefined || value === "standard") return "standard";
  if (value === "exact") return "exact";
  throw validationError(`${path} must be standard or exact.`);
}

function requireObject(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw validationError(`${path} must be a plain object.`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw validationError(`${path} must be a plain object.`);
  }
  return value as Record<string, unknown>;
}

function requireText(
  value: unknown,
  path: string,
  minimum: number,
  maximum: number,
): string {
  if (typeof value !== "string") throw validationError(`${path} must be text.`);
  const length = Array.from(value).length;
  if (length < minimum || length > maximum) {
    throw validationError(`${path} must contain ${minimum} to ${maximum} characters.`);
  }
  return value;
}

function requireInteger(value: unknown, path: string, minimum: number, maximum: number): number {
  if (!Number.isInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    throw validationError(`${path} must be an integer from ${minimum} to ${maximum}.`);
  }
  return value as number;
}

function exactKeys(
  object: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[],
  path: string,
): void {
  const allowed = new Set([...required, ...optional]);
  for (const key of required) {
    if (!Object.prototype.hasOwnProperty.call(object, key)) {
      throw validationError(`${path}.${key} is required.`);
    }
  }
  for (const key of Object.keys(object)) {
    if (!allowed.has(key)) throw validationError(`${path}.${key} is not supported.`);
  }
}

function validationError(message: string): Error {
  return new Error(`VALIDATION_FAILED: ${message}`);
}
