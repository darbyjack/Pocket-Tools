#pragma once

#include "PocketQuickJsNotifications.h"

#include <string>

namespace pocket_tools::quickjs::sources {

inline const char* notificationSnapshotRunner() {
  static const std::string source =
      R"POCKET_JS(
((baseRunner, legacyRunner) => {
  "use strict";

  const identifierPattern = /^[a-z][A-Za-z0-9]*$/;

  const fail = (code, message) => {
    const error = new Error(message);
    error.code = code;
    throw error;
  };

  const isPlainObject = (value) => {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  };

  const notificationId = (value, path) => {
    if (typeof value !== "string" || !identifierPattern.test(value)) {
      fail("INVALID_RUNTIME_REQUEST", `${path} must be a lower camelCase identifier.`);
    }
    if (Array.from(value).length > 80) {
      fail("INVALID_RUNTIME_REQUEST", `${path} must contain at most 80 characters.`);
    }
    return value;
  };

  const initialDesired = (request) => {
    const value = request?.notifications ?? {};
    if (!isPlainObject(value)) {
      fail("INVALID_RUNTIME_REQUEST", "request.notifications must be a plain object.");
    }
    const desired = new Set();
    for (const id of Object.keys(value)) {
      desired.add(notificationId(id, `request.notifications.${id}`));
    }
    if (desired.size > 64) {
      fail("INVALID_RUNTIME_REQUEST", "request.notifications may contain at most 64 schedules.");
    }
    return desired;
  };

  const enhanceNotifications = (notifications, desired) => Object.freeze({
    schedule(request) {
      const id = notificationId(request?.id, "notifications.schedule.id");
      const alreadyDesired = desired.has(id);
      desired.add(id);
      if (desired.size > 64) {
        if (!alreadyDesired) desired.delete(id);
        fail("NOTIFICATION_LIMIT_EXCEEDED", "A tool may own at most 64 desired schedules.");
      }
      try {
        return notifications.schedule(request);
      } catch (error) {
        if (error?.code === "INVALID_BRIDGE_VALUE") {
          fail("VALIDATION_FAILED", error.message);
        }
        throw error;
      }
    },
    cancel(id) {
      const normalized = notificationId(id, "notifications.cancel.id");
      desired.delete(normalized);
      return notifications.cancel(id);
    },
    cancelAll() {
      desired.clear();
      return notifications.cancelAll();
    },
  });

  const wrapActions = (actions, desired) => {
    if (!isPlainObject(actions)) return actions;
    return Object.fromEntries(
      Object.entries(actions).map(([name, original]) => [
        name,
        typeof original === "function"
          ? (context, input) => {
              const notifications = context.notifications;
              if (!isPlainObject(notifications)) {
                fail("INVALID_BRIDGE_VALUE", "The notification client is unavailable.");
              }
              return original(
                Object.freeze({
                  ...context,
                  notifications: enhanceNotifications(notifications, desired),
                }),
                input,
              );
            }
          : original,
      ]),
    );
  };

  return (definition, request) => {
    if (!isPlainObject(definition) || !isPlainObject(definition.manifest)) {
      return legacyRunner(definition, request);
    }
    const sdkVersion = definition.manifest.sdkVersion === 1
      ? "1.0"
      : definition.manifest.sdkVersion;
    if (sdkVersion !== "1.2") {
      return legacyRunner(definition, request);
    }
    if (request?.mode !== "action") {
      return baseRunner(definition, request);
    }

    const desired = initialDesired(request);
    return baseRunner(
      {
        ...definition,
        actions: wrapActions(definition.actions, desired),
      },
      request,
    );
  };
})(
)POCKET_JS" +
      std::string(notificationRunner()) +
      R"POCKET_JS(
,
)POCKET_JS" +
      std::string(feedbackRunner()) +
      R"POCKET_JS(
)
)POCKET_JS";
  return source.c_str();
}

}  // namespace pocket_tools::quickjs::sources
