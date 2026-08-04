import { isSerializableValue } from "@pocket-tools/sdk-contract";

import type { NotificationRequest, SerializableValue } from "../model.ts";

export interface NotificationOpenTargetValue {
  readonly hostId: string;
  readonly storageId: string;
  readonly notificationId: string;
  readonly screen?: string;
  readonly input?: unknown;
}

export interface NotificationRouteTarget {
  readonly hostId: string;
  readonly storageId: string;
  readonly notificationId: string;
  readonly screen: string;
  readonly input?: SerializableValue;
}

export function extractNotificationHostId(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "pocket-tools:" || parsed.hostname !== "notification") return null;
  const hostId = parsed.searchParams.get("hostId");
  return hostId === null || hostId.length === 0 ? null : hostId;
}

export function normalizeNotificationOpenTarget(
  target: NotificationOpenTargetValue | null,
): NotificationRouteTarget | null {
  if (target === null) return null;
  if (
    typeof target.hostId !== "string" ||
    typeof target.storageId !== "string" ||
    typeof target.notificationId !== "string" ||
    target.hostId.length === 0 ||
    target.storageId.length === 0 ||
    target.notificationId.length === 0
  ) {
    throw new Error("NOTIFICATION_ROUTE_INVALID: Native routing identity is invalid.");
  }
  const screen = target.screen ?? "home";
  if (!/^[a-z][A-Za-z0-9]*$/.test(screen)) {
    throw new Error("NOTIFICATION_ROUTE_INVALID: Native routing screen is invalid.");
  }
  if (target.input !== undefined && !isSerializableValue(target.input)) {
    throw new Error("NOTIFICATION_ROUTE_INVALID: Native routing input is invalid.");
  }
  return {
    hostId: target.hostId,
    storageId: target.storageId,
    notificationId: target.notificationId,
    screen,
    ...(target.input === undefined ? {} : { input: target.input }),
  };
}

export function describeNotificationTrigger(request: NotificationRequest): string {
  const trigger = request.trigger;
  if (trigger.type === "immediate") return "Immediate";
  if (trigger.type === "date") return `Once at ${new Date(trigger.at).toLocaleString()}`;
  const time = new Date(2000, 0, 1, trigger.hour, trigger.minute).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
  if (trigger.type === "daily") return `Daily at ${time}`;
  const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  return `${weekdays[trigger.weekday - 1]} at ${time}`;
}
