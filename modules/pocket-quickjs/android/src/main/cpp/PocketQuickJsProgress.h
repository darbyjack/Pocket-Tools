#pragma once

#include "PocketQuickJsBadge.h"

#include <string>

namespace pocket_tools::quickjs::sources {

inline const char* progressSdk() {
  static const std::string source = [] {
    std::string sdk = badgeSdk();
    const std::string marker =
        "  badge: (definition) => typed(\"badge\", definition),\n";
    const auto position = sdk.find(marker);
    if (position != std::string::npos) {
      sdk.insert(
          position + marker.size(),
          "  progress: (definition) => typed(\"progress\", definition),\n");
    }
    return sdk;
  }();
  return source.c_str();
}

inline const char* progressRunner() {
  static const std::string source =
      R"POCKET_JS(
((baseRunner) => {
  "use strict";

  const formats = new Set(["number", "percent"]);

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

    const isProgress = value.type === "progress";
    if (isProgress) {
      if (sdkVersion !== "1.2") {
        fail("VALIDATION_FAILED", `${path}: Progress nodes require SDK 1.2.`);
      }
      exactKeys(value, ["type", "label", "value", "min", "max", "format"], path);
      if (value.label !== undefined && typeof value.label !== "string") {
        fail("VALIDATION_FAILED", `${path}.label must be text.`);
      }
      if (typeof value.value !== "number" || !Number.isFinite(value.value)) {
        fail("VALIDATION_FAILED", `${path}.value must be a finite number.`);
      }
      if (
        value.min !== undefined &&
        (typeof value.min !== "number" || !Number.isFinite(value.min))
      ) {
        fail("VALIDATION_FAILED", `${path}.min must be a finite number.`);
      }
      if (
        value.max !== undefined &&
        (typeof value.max !== "number" || !Number.isFinite(value.max))
      ) {
        fail("VALIDATION_FAILED", `${path}.max must be a finite number.`);
      }
      const minimum = value.min ?? 0;
      const maximum = value.max ?? 100;
      if (maximum <= minimum) {
        fail("VALIDATION_FAILED", `${path}.max must be greater than min.`);
      }
      if (
        value.format !== undefined &&
        (typeof value.format !== "string" || !formats.has(value.format))
      ) {
        fail("VALIDATION_FAILED", `${path}.format must be number or percent.`);
      }

      const annotation = { value: value.value };
      if (value.label !== undefined) annotation.label = value.label;
      if (value.min !== undefined) annotation.min = value.min;
      if (value.max !== undefined) annotation.max = value.max;
      if (value.format !== undefined) annotation.format = value.format;
      annotations.set(path, annotation);
      state.seen.delete(value);
      return { type: "text", text: String(value.value) };
    }

    const transformed = {};
    for (const [key, entry] of Object.entries(value)) {
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

    if (annotations.has(path)) {
      return { type: "progress", ...annotations.get(path) };
    }

    const restored = {};
    for (const [key, entry] of Object.entries(value)) {
      restored[key] = restorePage(entry, `${path}.${key}`, annotations);
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
      std::string(badgeRunner()) +
      R"POCKET_JS(
)
)POCKET_JS";
  return source.c_str();
}

}  // namespace pocket_tools::quickjs::sources
