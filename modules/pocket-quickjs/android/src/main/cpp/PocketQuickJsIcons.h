#pragma once

#include "PocketQuickJsProgress.h"

#include <string>

namespace pocket_tools::quickjs::sources {

inline const char* iconsSdk() {
  return progressSdk();
}

inline const char* iconsRunner() {
  static const std::string source =
      R"POCKET_JS(
((baseRunner) => {
  "use strict";

  const iconNames = new Set([
    "add",
    "edit",
    "delete",
    "check",
    "calendar",
    "clock",
    "copy",
    "share",
    "search",
    "settings",
    "warning",
    "info",
    "money",
    "list",
    "refresh",
  ]);

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

  const validateIcon = (value, path, sdkVersion) => {
    if (sdkVersion !== "1.2") {
      fail("VALIDATION_FAILED", `${path}: Fixed host icons require SDK 1.2.`);
    }
    if (typeof value !== "string" || !iconNames.has(value)) {
      fail(
        "VALIDATION_FAILED",
        `${path} must be add, edit, delete, check, calendar, clock, copy, share, search, settings, warning, info, money, list, or refresh.`,
      );
    }
  };

  const transformPage = (value, path, sdkVersion, annotations, state, depth) => {
    if (depth > 32) fail("INVALID_BRIDGE_VALUE", `${path} exceeds bridge depth limits.`);
    state.visited += 1;
    if (state.visited > 10_000) {
      fail("INVALID_BRIDGE_VALUE", `${path} exceeds bridge complexity limits.`);
    }
    if (value === null || typeof value !== "object") return value;
    if (state.seen.has(value)) {
      fail("INVALID_BRIDGE_VALUE", `${path} contains a circular reference.`);
    }
    state.seen.add(value);

    if (Array.isArray(value)) {
      const result = value.map((entry, index) =>
        transformPage(
          entry,
          `${path}[${index}]`,
          sdkVersion,
          annotations,
          state,
          depth + 1,
        ));
      state.seen.delete(value);
      return result;
    }
    if (!isPlainObject(value)) {
      state.seen.delete(value);
      return value;
    }

    const isActionControl =
      value.type === "button" ||
      (value.type === undefined && typeof value.label === "string" && typeof value.action === "string");
    const isListItem = value.type === "list-item";
    const annotation = {};

    if (isActionControl && Object.prototype.hasOwnProperty.call(value, "icon")) {
      validateIcon(value.icon, `${path}.icon`, sdkVersion);
      annotation.icon = value.icon;
    }
    if (isListItem && Object.prototype.hasOwnProperty.call(value, "leadingIcon")) {
      validateIcon(value.leadingIcon, `${path}.leadingIcon`, sdkVersion);
      annotation.leadingIcon = value.leadingIcon;
    }
    if (Object.keys(annotation).length > 0) annotations.set(path, annotation);

    const transformed = {};
    for (const [key, entry] of Object.entries(value)) {
      if (isActionControl && key === "icon") continue;
      if (isListItem && key === "leadingIcon") continue;
      transformed[key] = transformPage(
        entry,
        `${path}.${key}`,
        sdkVersion,
        annotations,
        state,
        depth + 1,
      );
    }
    state.seen.delete(value);
    return transformed;
  };

  const restorePage = (value, path, annotations) => {
    if (Array.isArray(value)) {
      return value.map((entry, index) => restorePage(entry, `${path}[${index}]`, annotations));
    }
    if (!isPlainObject(value)) return value;

    const restored = {};
    for (const [key, entry] of Object.entries(value)) {
      restored[key] = restorePage(entry, `${path}.${key}`, annotations);
    }
    if (annotations.has(path)) Object.assign(restored, annotations.get(path));
    return restored;
  };

  return (definition, request) => {
    if (!isPlainObject(definition) || !isPlainObject(definition.manifest)) {
      return baseRunner(definition, request);
    }

    const sdkVersion = definition.manifest.sdkVersion === 1
      ? "1.0"
      : definition.manifest.sdkVersion;
    const annotations = new Map();
    const wrappedScreens = isPlainObject(definition.screens)
      ? Object.fromEntries(
          Object.entries(definition.screens).map(([name, original]) => [
            name,
            typeof original === "function"
              ? (context, input) => {
                  annotations.clear();
                  return transformPage(
                    original(context, input),
                    "page",
                    sdkVersion,
                    annotations,
                    { seen: new Set(), visited: 0 },
                    0,
                  );
                }
              : original,
          ]),
        )
      : definition.screens;

    const response = baseRunner({ ...definition, screens: wrappedScreens }, request);
    if (response?.ok !== true || !isPlainObject(response.value)) return response;
    if (response.value.page === undefined || annotations.size === 0) return response;

    return {
      ...response,
      value: {
        ...response.value,
        page: restorePage(response.value.page, "page", annotations),
      },
    };
  };
})(
)POCKET_JS" +
      std::string(progressRunner()) +
      R"POCKET_JS(
)
)POCKET_JS";
  return source.c_str();
}

}  // namespace pocket_tools::quickjs::sources
