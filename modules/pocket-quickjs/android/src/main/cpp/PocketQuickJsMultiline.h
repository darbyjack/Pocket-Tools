#pragma once

#include "PocketQuickJsNotificationSnapshot.h"

#include <string>

namespace pocket_tools::quickjs::sources {

inline const char* multilineRunner() {
  static const std::string source =
      R"POCKET_JS(
((baseRunner) => {
  "use strict";

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

  const sanitizeNode = (value, path, sdkVersion, state, depth) => {
    if (depth > 32) fail("INVALID_BRIDGE_VALUE", `${path} exceeds bridge depth limits.`);
    state.visited += 1;
    if (state.visited > 10_000) {
      fail("INVALID_BRIDGE_VALUE", `${path} exceeds bridge complexity limits.`);
    }
    if (value === null || typeof value !== "object") return value;
    if (state.seen.has(value)) fail("INVALID_BRIDGE_VALUE", `${path} contains a circular reference.`);
    state.seen.add(value);

    if (Array.isArray(value)) {
      const sanitized = value.map((entry, index) =>
        sanitizeNode(entry, `${path}[${index}]`, sdkVersion, state, depth + 1));
      state.seen.delete(value);
      return sanitized;
    }
    if (!isPlainObject(value)) {
      state.seen.delete(value);
      return value;
    }

    const isTextInput = value.type === "text-input";
    const hasMultiline = Object.prototype.hasOwnProperty.call(value, "multiline");
    const hasMinLines = Object.prototype.hasOwnProperty.call(value, "minLines");
    if (isTextInput && (hasMultiline || hasMinLines)) {
      if (sdkVersion !== "1.2") {
        fail("VALIDATION_FAILED", `${path}: Multiline text inputs require SDK 1.2.`);
      }
      if (hasMultiline && typeof value.multiline !== "boolean") {
        fail("VALIDATION_FAILED", `${path}.multiline must be a boolean.`);
      }
      if (hasMinLines) {
        if (value.multiline !== true) {
          fail("VALIDATION_FAILED", `${path}.minLines requires multiline: true.`);
        }
        if (!Number.isInteger(value.minLines) || value.minLines < 2 || value.minLines > 8) {
          fail("VALIDATION_FAILED", `${path}.minLines must be an integer from 2 to 8.`);
        }
      }
      state.annotations.set(
        path,
        Object.freeze({
          ...(hasMultiline ? { multiline: value.multiline } : {}),
          ...(hasMinLines ? { minLines: value.minLines } : {}),
        }),
      );
    }

    const sanitized = {};
    for (const [key, entry] of Object.entries(value)) {
      if (isTextInput && (key === "multiline" || key === "minLines")) continue;
      sanitized[key] = sanitizeNode(entry, `${path}.${key}`, sdkVersion, state, depth + 1);
    }
    state.seen.delete(value);
    return sanitized;
  };

  const restoreNode = (value, path, annotations) => {
    if (Array.isArray(value)) {
      return value.map((entry, index) => restoreNode(entry, `${path}[${index}]`, annotations));
    }
    if (!isPlainObject(value)) return value;

    const restored = {};
    for (const [key, entry] of Object.entries(value)) {
      restored[key] = restoreNode(entry, `${path}.${key}`, annotations);
    }
    const annotation = annotations.get(path);
    return annotation === undefined ? restored : { ...restored, ...annotation };
  };

  const wrapScreens = (screens, sdkVersion, annotations) => {
    if (!isPlainObject(screens)) return screens;
    return Object.fromEntries(
      Object.entries(screens).map(([name, original]) => [
        name,
        typeof original === "function"
          ? (context, input) => {
              annotations.clear();
              const state = { annotations, seen: new Set(), visited: 0 };
              return sanitizeNode(original(context, input), "page", sdkVersion, state, 0);
            }
          : original,
      ]),
    );
  };

  return (definition, request) => {
    if (!isPlainObject(definition) || !isPlainObject(definition.manifest)) {
      return baseRunner(definition, request);
    }

    const sdkVersion = definition.manifest.sdkVersion === 1
      ? "1.0"
      : definition.manifest.sdkVersion;
    const annotations = new Map();
    const wrapped = {
      ...definition,
      screens: wrapScreens(definition.screens, sdkVersion, annotations),
    };
    const response = baseRunner(wrapped, request);
    if (
      response?.ok !== true ||
      request?.mode !== "render" ||
      response.value?.page === undefined ||
      annotations.size === 0
    ) {
      return response;
    }

    return {
      ...response,
      value: {
        ...response.value,
        page: restoreNode(response.value.page, "page", annotations),
      },
    };
  };
})(
)POCKET_JS" +
      std::string(notificationSnapshotRunner()) +
      R"POCKET_JS(
)
)POCKET_JS";
  return source.c_str();
}

}  // namespace pocket_tools::quickjs::sources
