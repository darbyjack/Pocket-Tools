#pragma once

#include "PocketQuickJsMultiSelect.h"

#include <string>

namespace pocket_tools::quickjs::sources {

inline const char* badgeSdk() {
  static const std::string source = [] {
    std::string sdk = multiSelectSdk();
    const std::string marker =
        "  summary: (definition) => typed(\"summary\", definition),\n";
    const auto position = sdk.find(marker);
    if (position != std::string::npos) {
      sdk.insert(
          position + marker.size(),
          "  badge: (definition) => typed(\"badge\", definition),\n");
    }
    return sdk;
  }();
  return source.c_str();
}

inline const char* badgeRunner() {
  static const std::string source =
      R"POCKET_JS(
((baseRunner) => {
  "use strict";

  const tones = new Set(["neutral", "info", "success", "warning", "danger"]);

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

  const exactKeys = (value, allowed, path) => {
    for (const key of Object.keys(value)) {
      if (!allowed.includes(key)) {
        fail("VALIDATION_FAILED", `${path}.${key} is not supported.`);
      }
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

    const isBadge = value.type === "badge";
    if (isBadge) {
      if (sdkVersion !== "1.2") {
        fail("VALIDATION_FAILED", `${path}: Badge nodes require SDK 1.2.`);
      }
      exactKeys(value, ["type", "text", "tone"], path);
      if (
        typeof value.text !== "string" ||
        Array.from(value.text).length < 1 ||
        Array.from(value.text).length > 80
      ) {
        fail("VALIDATION_FAILED", `${path}.text must contain 1 to 80 characters.`);
      }
      if (
        value.tone !== undefined &&
        (typeof value.tone !== "string" || !tones.has(value.tone))
      ) {
        fail(
          "VALIDATION_FAILED",
          `${path}.tone must be neutral, info, success, warning, or danger.`,
        );
      }
      annotations.set(path, value.tone);
    }

    const transformed = {};
    for (const [key, entry] of Object.entries(value)) {
      if (isBadge && key === "tone") continue;
      transformed[key] = transformPage(
        entry,
        `${path}.${key}`,
        sdkVersion,
        annotations,
        state,
        depth + 1,
      );
    }
    if (isBadge) transformed.type = "text";
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
    if (annotations.has(path)) {
      restored.type = "badge";
      const tone = annotations.get(path);
      if (tone !== undefined) restored.tone = tone;
    }
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
      std::string(multiSelectRunner()) +
      R"POCKET_JS(
)
)POCKET_JS";
  return source.c_str();
}

}  // namespace pocket_tools::quickjs::sources
