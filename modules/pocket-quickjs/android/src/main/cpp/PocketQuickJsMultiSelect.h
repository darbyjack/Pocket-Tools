#pragma once

#include "PocketQuickJsMultiline.h"

#include <string>

namespace pocket_tools::quickjs::sources {

inline const char* multiSelectSdk() {
  static const std::string source = R"POCKET_JS(
const typed = (type, definition = {}) => ({ type, ...definition });

export const defineMiniApp = (definition) => definition;
export const collection = (fields) => ({ fields });

export const field = Object.freeze({
  text: (definition) => typed("text", definition),
  boolean: (definition) => typed("boolean", definition),
  number: (definition) => typed("number", definition),
  money: (definition) => typed("money", definition),
  date: (definition) => typed("date", definition),
  datetime: (definition) => typed("datetime", definition),
});

export const setting = Object.freeze({
  text: (definition) => typed("text", definition),
  boolean: (definition) => typed("boolean", definition),
  number: (definition) => typed("number", definition),
  money: (definition) => typed("money", definition),
  select: (definition) => typed("select", definition),
  date: (definition) => typed("date", definition),
  datetime: (definition) => typed("datetime", definition),
  multiSelect: (definition) => typed("multi-select", definition),
});

export const ui = Object.freeze({
  action: (definition) => ({ ...definition }),
  page: (definition) => typed("page", definition),
  section: (definition) => typed("section", definition),
  row: (definition) => typed("row", definition),
  column: (definition) => typed("column", definition),
  heading: (definition) => typed("heading", definition),
  text: (definition) => typed("text", definition),
  metric: (definition) => typed("metric", definition),
  timer: (definition) => typed("timer", definition),
  textInput: (definition) => typed("text-input", definition),
  numberInput: (definition) => typed("number-input", definition),
  toggle: (definition) => typed("toggle", definition),
  select: (definition) => typed("select", definition),
  dateInput: (definition) => typed("date-input", definition),
  datetimeInput: (definition) => typed("datetime-input", definition),
  multiSelect: (definition) => typed("multi-select", definition),
  button: (definition) => typed("button", definition),
  navigation: (definition) => typed("navigation", definition),
  emptyState: (definition) => typed("empty-state", definition),
  listItem: (definition) => typed("list-item", definition),
  list: (definition) => typed("list", definition),
  summary: (definition) => typed("summary", definition),
});
)POCKET_JS";
  return source.c_str();
}

inline const char* multiSelectRunner() {
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

  const exactKeys = (value, allowed, path) => {
    for (const key of Object.keys(value)) {
      if (!allowed.includes(key)) {
        fail("VALIDATION_FAILED", `${path}.${key} is not supported.`);
      }
    }
  };

  const isSelectValue = (value) =>
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value));

  const valueKey = (value) => `${typeof value}:${String(value)}`;

  const validateMultiSelectDefinition = (value, path) => {
    exactKeys(
      value,
      [
        "type",
        "label",
        "description",
        "default",
        "visibleWhen",
        "options",
        "minSelections",
        "maxSelections",
      ],
      path,
    );
    if (typeof value.label !== "string" || value.label.length < 1 || value.label.length > 120) {
      fail("VALIDATION_FAILED", `${path}.label must contain 1 to 120 characters.`);
    }
    if (
      value.description !== undefined &&
      (typeof value.description !== "string" || value.description.length > 500)
    ) {
      fail("VALIDATION_FAILED", `${path}.description must contain at most 500 characters.`);
    }
    if (!Array.isArray(value.options) || value.options.length < 1 || value.options.length > 100) {
      fail("VALIDATION_FAILED", `${path}.options must contain between 1 and 100 options.`);
    }

    const optionKeys = new Set();
    const options = value.options.map((rawOption, index) => {
      const optionPath = `${path}.options[${index}]`;
      if (!isPlainObject(rawOption)) {
        fail("VALIDATION_FAILED", `${optionPath} must be a plain object.`);
      }
      exactKeys(rawOption, ["label", "value"], optionPath);
      if (
        typeof rawOption.label !== "string" ||
        rawOption.label.length < 1 ||
        rawOption.label.length > 120
      ) {
        fail("VALIDATION_FAILED", `${optionPath}.label must contain 1 to 120 characters.`);
      }
      if (!isSelectValue(rawOption.value)) {
        fail(
          "VALIDATION_FAILED",
          `${optionPath}.value must be a finite string, number, or boolean.`,
        );
      }
      const key = valueKey(rawOption.value);
      if (optionKeys.has(key)) {
        fail("VALIDATION_FAILED", `${optionPath}.value must be unique.`);
      }
      optionKeys.add(key);
      return Object.freeze({ label: rawOption.label, value: rawOption.value });
    });

    const validateBound = (bound, name) => {
      if (
        bound !== undefined &&
        (!Number.isInteger(bound) || bound < 0 || bound > options.length)
      ) {
        fail(
          "VALIDATION_FAILED",
          `${path}.${name} must be an integer from 0 to ${options.length}.`,
        );
      }
    };
    validateBound(value.minSelections, "minSelections");
    validateBound(value.maxSelections, "maxSelections");
    const minimum = value.minSelections ?? 0;
    const maximum = value.maxSelections ?? options.length;
    if (minimum > maximum) {
      fail("VALIDATION_FAILED", `${path} minimum selections cannot exceed maximum selections.`);
    }

    const normalizedDefault = normalizeMultiSelectValue(
      { options, minSelections: minimum, maxSelections: maximum },
      value.default,
      `${path}.default`,
      false,
    );
    return Object.freeze({
      ...value,
      options: Object.freeze(options),
      default: Object.freeze(normalizedDefault),
      ...(value.minSelections === undefined ? {} : { minSelections: minimum }),
      ...(value.maxSelections === undefined ? {} : { maxSelections: maximum }),
    });
  };

  const normalizeMultiSelectValue = (definition, value, path, requireCanonical) => {
    if (!Array.isArray(value)) {
      fail("VALIDATION_FAILED", `${path} must be an array of declared option values.`);
    }
    const declared = new Map(
      definition.options.map((option) => [valueKey(option.value), option.value]),
    );
    const selected = new Set();
    for (let index = 0; index < value.length; index += 1) {
      const entry = value[index];
      if (!isSelectValue(entry)) {
        fail(
          "VALIDATION_FAILED",
          `${path}[${index}] must be a finite string, number, or boolean option value.`,
        );
      }
      const key = valueKey(entry);
      if (!declared.has(key)) {
        fail("VALIDATION_FAILED", `${path}[${index}] is not a declared option value.`);
      }
      if (selected.has(key)) {
        fail("VALIDATION_FAILED", `${path}[${index}] duplicates a selected option.`);
      }
      selected.add(key);
    }

    const minimum = definition.minSelections ?? 0;
    const maximum = definition.maxSelections ?? definition.options.length;
    if (selected.size < minimum) {
      fail("VALIDATION_FAILED", `${path} is below the minimum selection count.`);
    }
    if (selected.size > maximum) {
      fail("VALIDATION_FAILED", `${path} exceeds the maximum selection count.`);
    }

    const canonical = definition.options
      .filter((option) => selected.has(valueKey(option.value)))
      .map((option) => option.value);
    if (
      requireCanonical &&
      (canonical.length !== value.length ||
        canonical.some((entry, index) => entry !== value[index]))
    ) {
      fail("VALIDATION_FAILED", `${path} must follow declared option order.`);
    }
    return canonical;
  };

  const encodedValue = (definition, value, path, requireCanonical) =>
    JSON.stringify(normalizeMultiSelectValue(definition, value, path, requireCanonical));

  const decodedValue = (definition, value, path, requireCanonical = true) => {
    if (typeof value !== "string") {
      fail("INVALID_BRIDGE_VALUE", `${path} must be an encoded multi-select value.`);
    }
    let parsed;
    try {
      parsed = JSON.parse(value);
    } catch {
      fail("INVALID_BRIDGE_VALUE", `${path} contains invalid encoded multi-select data.`);
    }
    return normalizeMultiSelectValue(definition, parsed, path, requireCanonical);
  };

  const transformPage = (value, path, sdkVersion, definitions, annotations, state, depth) => {
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
        transformPage(entry, `${path}[${index}]`, sdkVersion, definitions, annotations, state, depth + 1));
      state.seen.delete(value);
      return result;
    }
    if (!isPlainObject(value)) {
      state.seen.delete(value);
      return value;
    }

    const settingName = typeof value.setting === "string" ? value.setting : undefined;
    if (
      settingName !== undefined &&
      definitions.has(settingName) &&
      value.type !== "multi-select"
    ) {
      fail(
        "VALIDATION_FAILED",
        `${path}.setting binds a multi-select setting to an incompatible UI node.`,
      );
    }

    const isMultiSelect = value.type === "multi-select";
    if (isMultiSelect) {
      if (sdkVersion !== "1.2") {
        fail("VALIDATION_FAILED", `${path}: Multi-select inputs require SDK 1.2.`);
      }
      exactKeys(value, ["type", "setting", "label"], path);
      if (typeof settingName !== "string" || !definitions.has(settingName)) {
        fail("VALIDATION_FAILED", `${path}.setting must bind a declared multi-select setting.`);
      }
      if (
        value.label !== undefined &&
        (typeof value.label !== "string" || value.label.length < 1 || value.label.length > 120)
      ) {
        fail("VALIDATION_FAILED", `${path}.label must contain 1 to 120 characters.`);
      }
      annotations.add(path);
    }

    const transformed = {};
    for (const [key, entry] of Object.entries(value)) {
      transformed[key] = transformPage(
        entry,
        `${path}.${key}`,
        sdkVersion,
        definitions,
        annotations,
        state,
        depth + 1,
      );
    }
    if (isMultiSelect) transformed.type = "text-input";
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
    if (annotations.has(path)) restored.type = "multi-select";
    return restored;
  };

  return (definition, request) => {
    if (!isPlainObject(definition) || !isPlainObject(definition.manifest)) {
      return baseRunner(definition, request);
    }

    const sdkVersion = definition.manifest.sdkVersion === 1
      ? "1.0"
      : definition.manifest.sdkVersion;
    const rawSettings = isPlainObject(definition.settings) ? definition.settings : {};
    const multiSelectDefinitions = new Map();
    for (const [name, rawDefinition] of Object.entries(rawSettings)) {
      if (!isPlainObject(rawDefinition) || rawDefinition.type !== "multi-select") continue;
      if (sdkVersion !== "1.2") {
        fail("VALIDATION_FAILED", `settings.${name}: Multi-select settings require SDK 1.2.`);
      }
      multiSelectDefinitions.set(
        name,
        validateMultiSelectDefinition(rawDefinition, `settings.${name}`),
      );
    }

    for (const [name, rawDefinition] of Object.entries(rawSettings)) {
      if (!isPlainObject(rawDefinition) || !isPlainObject(rawDefinition.visibleWhen)) continue;
      if (multiSelectDefinitions.has(rawDefinition.visibleWhen.setting)) {
        fail(
          "VALIDATION_FAILED",
          `settings.${name}.visibleWhen.setting cannot reference a multi-select setting.`,
        );
      }
    }

    const transformedSettings = Object.fromEntries(
      Object.entries(rawSettings).map(([name, rawDefinition]) => {
        const multiSelect = multiSelectDefinitions.get(name);
        if (multiSelect === undefined) return [name, rawDefinition];
        return [
          name,
          {
            type: "text",
            label: multiSelect.label,
            ...(multiSelect.description === undefined
              ? {}
              : { description: multiSelect.description }),
            ...(multiSelect.visibleWhen === undefined
              ? {}
              : { visibleWhen: multiSelect.visibleWhen }),
            default: JSON.stringify(multiSelect.default),
            minLength: 2,
            maxLength: 10_000,
          },
        ];
      }),
    );

    let transformedRequest = request;
    if (isPlainObject(request) && isPlainObject(request.settings)) {
      const transformedValues = { ...request.settings };
      for (const [name, multiSelect] of multiSelectDefinitions) {
        if (Object.prototype.hasOwnProperty.call(transformedValues, name)) {
          transformedValues[name] = encodedValue(
            multiSelect,
            transformedValues[name],
            `request.settings.${name}`,
            true,
          );
        }
      }
      transformedRequest = { ...request, settings: transformedValues };
    }

    const adaptContext = (context) => {
      const settings = {
        get(name) {
          const value = context.settings.get(name);
          const multiSelect = multiSelectDefinitions.get(name);
          return multiSelect === undefined
            ? value
            : decodedValue(multiSelect, value, `settings.${name}`);
        },
      };
      if (typeof context.settings.set === "function") {
        settings.set = (name, value) => {
          const multiSelect = multiSelectDefinitions.get(name);
          if (multiSelect === undefined) {
            context.settings.set(name, value);
            return;
          }
          context.settings.set(
            name,
            encodedValue(multiSelect, value, `settings.${name}`, false),
          );
        };
      }
      if (typeof context.settings.reset === "function") {
        settings.reset = (name) => context.settings.reset(name);
      }
      return Object.freeze({ ...context, settings: Object.freeze(settings) });
    };

    const annotations = new Set();
    const wrappedScreens = isPlainObject(definition.screens)
      ? Object.fromEntries(
          Object.entries(definition.screens).map(([name, original]) => [
            name,
            typeof original === "function"
              ? (context, input) => {
                  annotations.clear();
                  const page = original(adaptContext(context), input);
                  return transformPage(
                    page,
                    "page",
                    sdkVersion,
                    multiSelectDefinitions,
                    annotations,
                    { seen: new Set(), visited: 0 },
                    0,
                  );
                }
              : original,
          ]),
        )
      : definition.screens;
    const wrappedActions = isPlainObject(definition.actions)
      ? Object.fromEntries(
          Object.entries(definition.actions).map(([name, original]) => [
            name,
            typeof original === "function"
              ? (context, input) => original(adaptContext(context), input)
              : original,
          ]),
        )
      : definition.actions;

    const response = baseRunner(
      {
        ...definition,
        settings: transformedSettings,
        screens: wrappedScreens,
        actions: wrappedActions,
      },
      transformedRequest,
    );
    if (response?.ok !== true || !isPlainObject(response.value)) return response;

    const value = { ...response.value };
    if (isPlainObject(value.inspection) && isPlainObject(value.inspection.settings)) {
      const settings = { ...value.inspection.settings };
      for (const [name, multiSelect] of multiSelectDefinitions) settings[name] = multiSelect;
      value.inspection = { ...value.inspection, settings };
    }
    if (Array.isArray(value.operations)) {
      value.operations = value.operations.map((operation, index) => {
        if (
          !isPlainObject(operation) ||
          operation.type !== "setting-set" ||
          !multiSelectDefinitions.has(operation.setting)
        ) {
          return operation;
        }
        const multiSelect = multiSelectDefinitions.get(operation.setting);
        return {
          ...operation,
          value: decodedValue(
            multiSelect,
            operation.value,
            `operations[${index}].value`,
          ),
        };
      });
    }
    if (value.page !== undefined && annotations.size > 0) {
      value.page = restorePage(value.page, "page", annotations);
    }
    return { ...response, value };
  };
})(
)POCKET_JS" +
      std::string(multilineRunner()) +
      R"POCKET_JS(
)
)POCKET_JS";
  return source.c_str();
}

}  // namespace pocket_tools::quickjs::sources
