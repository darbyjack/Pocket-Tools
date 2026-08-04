#pragma once

#include "PocketQuickJsFeedback.h"

#include <string>

namespace pocket_tools::quickjs::sources {

inline const char* notificationRunner() {
  static const std::string source =
      R"POCKET_JS(
((baseRunner) => {
  "use strict";

  const identifierPattern = /^[a-z][A-Za-z0-9]*$/;
  const dateTimePattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{3})Z$/;
  const unsafeKeys = new Set(["__proto__", "constructor", "prototype"]);

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

  const exactKeys = (value, required, optional, path) => {
    const allowed = new Set([...required, ...optional]);
    for (const key of required) {
      if (!Object.prototype.hasOwnProperty.call(value, key)) {
        fail("VALIDATION_FAILED", `${path}.${key} is required.`);
      }
    }
    for (const key of Object.keys(value)) {
      if (!allowed.has(key)) fail("VALIDATION_FAILED", `${path}.${key} is not supported.`);
    }
  };

  const text = (value, path, minimum, maximum) => {
    if (typeof value !== "string") fail("VALIDATION_FAILED", `${path} must be text.`);
    const length = Array.from(value).length;
    if (length < minimum || length > maximum) {
      fail("VALIDATION_FAILED", `${path} must contain ${minimum} to ${maximum} characters.`);
    }
    return value;
  };

  const identifier = (value, path) => {
    if (typeof value !== "string" || !identifierPattern.test(value)) {
      fail("VALIDATION_FAILED", `${path} must be a lower camelCase identifier.`);
    }
    if (Array.from(value).length > 80) {
      fail("VALIDATION_FAILED", `${path} must contain at most 80 characters.`);
    }
    return value;
  };

  const integer = (value, path, minimum, maximum) => {
    if (!Number.isInteger(value) || value < minimum || value > maximum) {
      fail("VALIDATION_FAILED", `${path} must be an integer from ${minimum} to ${maximum}.`);
    }
    return value;
  };

  const assertSerializable = (value, path) => {
    const seen = new Set();
    let visited = 0;
    const visit = (current, currentPath, depth) => {
      visited += 1;
      if (visited > 10_000 || depth > 32) {
        fail("INVALID_BRIDGE_VALUE", `${currentPath} exceeds bridge complexity limits.`);
      }
      if (current === null || typeof current === "string" || typeof current === "boolean") return;
      if (typeof current === "number") {
        if (!Number.isFinite(current)) {
          fail("INVALID_BRIDGE_VALUE", `${currentPath} contains a non-finite number.`);
        }
        return;
      }
      if (typeof current !== "object") {
        fail("INVALID_BRIDGE_VALUE", `${currentPath} is not serializable.`);
      }
      if (seen.has(current)) {
        fail("INVALID_BRIDGE_VALUE", `${currentPath} contains a circular reference.`);
      }
      seen.add(current);
      if (Array.isArray(current)) {
        for (let index = 0; index < current.length; index += 1) {
          visit(current[index], `${currentPath}[${index}]`, depth + 1);
        }
      } else {
        if (!isPlainObject(current)) {
          fail("INVALID_BRIDGE_VALUE", `${currentPath} must contain plain objects only.`);
        }
        for (const key of Object.keys(current)) {
          if (unsafeKeys.has(key)) {
            fail("INVALID_BRIDGE_VALUE", `${currentPath}.${key} is not an allowed key.`);
          }
          visit(current[key], `${currentPath}.${key}`, depth + 1);
        }
      }
      seen.delete(current);
    };
    visit(value, path, 0);
  };

  const isCanonicalDateTime = (value) => {
    if (typeof value !== "string" || !dateTimePattern.test(value)) return false;
    const year = Number(value.slice(0, 4));
    if (year < 1 || year > 9999) return false;
    const milliseconds = Date.parse(value);
    if (!Number.isFinite(milliseconds)) return false;
    try {
      return new Date(milliseconds).toISOString() === value;
    } catch {
      return false;
    }
  };

  const delivery = (value, path) => {
    if (value === undefined || value === "standard") return "standard";
    if (value === "exact") return "exact";
    fail("VALIDATION_FAILED", `${path} must be standard or exact.`);
  };

  const normalizeTrigger = (value, now, path) => {
    if (!isPlainObject(value)) fail("VALIDATION_FAILED", `${path} must be a plain object.`);
    if (value.type === "immediate") {
      exactKeys(value, ["type"], [], path);
      return Object.freeze({ type: "immediate" });
    }
    if (value.type === "date") {
      exactKeys(value, ["type", "at"], ["delivery"], path);
      if (!isCanonicalDateTime(value.at)) {
        fail("VALIDATION_FAILED", `${path}.at must be a canonical UTC date-time.`);
      }
      if (!isCanonicalDateTime(now) || Date.parse(value.at) <= Date.parse(now)) {
        fail("VALIDATION_FAILED", `${path}.at must be in the future.`);
      }
      return Object.freeze({
        type: "date",
        at: value.at,
        delivery: delivery(value.delivery, `${path}.delivery`),
      });
    }
    if (value.type === "daily") {
      exactKeys(value, ["type", "hour", "minute"], ["delivery"], path);
      return Object.freeze({
        type: "daily",
        hour: integer(value.hour, `${path}.hour`, 0, 23),
        minute: integer(value.minute, `${path}.minute`, 0, 59),
        delivery: delivery(value.delivery, `${path}.delivery`),
      });
    }
    if (value.type === "weekly") {
      exactKeys(value, ["type", "weekday", "hour", "minute"], ["delivery"], path);
      return Object.freeze({
        type: "weekly",
        weekday: integer(value.weekday, `${path}.weekday`, 1, 7),
        hour: integer(value.hour, `${path}.hour`, 0, 23),
        minute: integer(value.minute, `${path}.minute`, 0, 59),
        delivery: delivery(value.delivery, `${path}.delivery`),
      });
    }
    fail("VALIDATION_FAILED", `${path}.type is unsupported.`);
  };

  const normalizeOpen = (value, definition, path) => {
    if (!isPlainObject(value)) fail("VALIDATION_FAILED", `${path} must be a plain object.`);
    exactKeys(value, ["screen"], ["input"], path);
    const screen = identifier(value.screen, `${path}.screen`);
    if (typeof definition.screens?.[screen] !== "function") {
      fail("VALIDATION_FAILED", `${path}.screen must name a declared screen.`);
    }
    if (value.input !== undefined) assertSerializable(value.input, `${path}.input`);
    return Object.freeze({
      screen,
      ...(value.input === undefined ? {} : { input: value.input }),
    });
  };

  const normalizeRequest = (value, definition, now, path) => {
    if (!isPlainObject(value)) fail("VALIDATION_FAILED", `${path} must be a plain object.`);
    exactKeys(value, ["id", "title", "trigger"], ["body", "open"], path);
    const body = value.body === undefined ? undefined : text(value.body, `${path}.body`, 0, 240);
    const open =
      value.open === undefined ? undefined : normalizeOpen(value.open, definition, `${path}.open`);
    return Object.freeze({
      id: identifier(value.id, `${path}.id`),
      title: text(value.title, `${path}.title`, 1, 80),
      ...(body === undefined ? {} : { body }),
      trigger: normalizeTrigger(value.trigger, now, `${path}.trigger`),
      ...(open === undefined ? {} : { open }),
    });
  };

  const pushMarker = (state, marker) => {
    if (state.sequence.length >= 256) {
      fail("ACTION_LIMIT_EXCEEDED", "SDK 1.2 actions may request at most 256 durable operations.");
    }
    state.sequence.push(marker);
  };

  const markBase = (state, target, name) => (...args) => {
    pushMarker(state, Object.freeze({ kind: "base" }));
    return target[name](...args);
  };

  const wrapCollection = (collection, state) => Object.freeze({
    ...collection,
    insert: markBase(state, collection, "insert"),
    update: markBase(state, collection, "update"),
    remove: markBase(state, collection, "remove"),
  });

  const enhanceContext = (context, mode, state, definition, request) => {
    const settings = Object.freeze({
      ...context.settings,
      set: markBase(state, context.settings, "set"),
      reset: markBase(state, context.settings, "reset"),
    });
    const data = Object.freeze({
      collection(name) {
        return wrapCollection(context.data.collection(name), state);
      },
    });
    const timers = Object.freeze({
      ...context.timers,
      start: markBase(state, context.timers, "start"),
      stop: markBase(state, context.timers, "stop"),
    });
    const notifications = Object.freeze({
      schedule(value) {
        if (mode !== "action") {
          fail("INVALID_CONTEXT_OPERATION", "Notifications are available only during actions.");
        }
        const normalized = normalizeRequest(value, definition, request.now, "notifications.schedule");
        const alreadyDesired = state.desired.has(normalized.id);
        state.desired.add(normalized.id);
        if (state.desired.size > 64) {
          if (!alreadyDesired) state.desired.delete(normalized.id);
          fail("NOTIFICATION_LIMIT_EXCEEDED", "A tool may own at most 64 desired schedules.");
        }
        pushMarker(
          state,
          Object.freeze({
            kind: "notification",
            operation: Object.freeze({ type: "notification-schedule", request: normalized }),
          }),
        );
      },
      cancel(value) {
        if (mode !== "action") {
          fail("INVALID_CONTEXT_OPERATION", "Notifications are available only during actions.");
        }
        const notificationId = identifier(value, "notifications.cancel.id");
        state.desired.delete(notificationId);
        pushMarker(
          state,
          Object.freeze({
            kind: "notification",
            operation: Object.freeze({ type: "notification-cancel", notificationId }),
          }),
        );
      },
      cancelAll() {
        if (mode !== "action") {
          fail("INVALID_CONTEXT_OPERATION", "Notifications are available only during actions.");
        }
        state.desired.clear();
        pushMarker(
          state,
          Object.freeze({
            kind: "notification",
            operation: Object.freeze({ type: "notification-cancel-all" }),
          }),
        );
      },
    });
    return Object.freeze({
      ...context,
      settings,
      data,
      timers,
      notifications,
    });
  };

  const wrapFunctions = (functions, mode, state, definition, request) => {
    if (!isPlainObject(functions)) return functions;
    return Object.fromEntries(
      Object.entries(functions).map(([name, original]) => [
        name,
        typeof original === "function"
          ? (context, input) =>
              original(enhanceContext(context, mode, state, definition, request), input)
          : original,
      ]),
    );
  };

  const wrapDefinition = (definition, request, state) => {
    if (!isPlainObject(definition) || !isPlainObject(definition.manifest)) return definition;
    const sdkVersion = definition.manifest.sdkVersion === 1
      ? "1.0"
      : definition.manifest.sdkVersion;
    if (sdkVersion !== "1.2") return definition;

    const wrapped = { ...definition };
    wrapped.screens = wrapFunctions(definition.screens, "render", state, wrapped, request);
    wrapped.actions = wrapFunctions(definition.actions, "action", state, wrapped, request);
    return wrapped;
  };

  return (definition, request) => {
    const state = { sequence: [], desired: new Set() };
    const response = baseRunner(wrapDefinition(definition, request, state), request);
    if (response?.ok !== true || request?.mode !== "action") return response;

    const baseOperations = response.value?.operations;
    if (!Array.isArray(baseOperations)) {
      fail("INVALID_BRIDGE_VALUE", "The base runtime returned an invalid operation list.");
    }
    const operations = [];
    let baseIndex = 0;
    for (const marker of state.sequence) {
      if (marker.kind === "notification") {
        operations.push(marker.operation);
        continue;
      }
      const operation = baseOperations[baseIndex];
      if (operation === undefined) {
        fail("INVALID_BRIDGE_VALUE", "The base runtime operation sequence is inconsistent.");
      }
      operations.push(operation);
      baseIndex += 1;
    }
    if (baseIndex !== baseOperations.length) {
      fail("INVALID_BRIDGE_VALUE", "The base runtime operation sequence is inconsistent.");
    }

    return {
      ...response,
      value: {
        ...response.value,
        operations,
      },
    };
  };
})(
)POCKET_JS" +
      std::string(feedbackRunner()) +
      R"POCKET_JS(
)
)POCKET_JS";
  return source.c_str();
}

}  // namespace pocket_tools::quickjs::sources
