import type {
  MultiSelectSetting,
  SelectValue,
  SerializableValue,
} from "../model.ts";

export function selectValueKey(value: SelectValue): string {
  return `${typeof value}:${String(value)}`;
}

export function normalizeMultiSelectValue(
  definition: MultiSelectSetting,
  value: SerializableValue,
  path: string,
): readonly SelectValue[] {
  if (!Array.isArray(value)) fail(path, "Expected an array of declared option values.");

  const declaredByKey = new Map(
    definition.options.map((option) => [selectValueKey(option.value), option.value] as const),
  );
  const selected = new Set<string>();
  for (const [index, entry] of value.entries()) {
    if (!isSelectValue(entry)) {
      fail(`${path}[${index}]`, "Expected a finite string, number, or boolean option value.");
    }
    const key = selectValueKey(entry);
    if (!declaredByKey.has(key)) {
      fail(`${path}[${index}]`, "Value is not one of the declared options.");
    }
    if (selected.has(key)) fail(`${path}[${index}]`, "Selections must be unique.");
    selected.add(key);
  }

  const minimum = definition.minSelections ?? 0;
  const maximum = definition.maxSelections ?? definition.options.length;
  if (selected.size < minimum) fail(path, "Selection count is below the minimum.");
  if (selected.size > maximum) fail(path, "Selection count exceeds the maximum.");

  return definition.options
    .filter((option) => selected.has(selectValueKey(option.value)))
    .map((option) => option.value);
}

export function assertCanonicalMultiSelectValue(
  definition: MultiSelectSetting,
  value: SerializableValue,
  path: string,
): asserts value is readonly SelectValue[] {
  const canonical = normalizeMultiSelectValue(definition, value, path);
  if (
    !Array.isArray(value) ||
    value.length !== canonical.length ||
    value.some((entry, index) => entry !== canonical[index])
  ) {
    fail(path, "Selections must follow declared option order.");
  }
}

function isSelectValue(value: SerializableValue): value is SelectValue {
  return (
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  );
}

function fail(path: string, message: string): never {
  throw new Error(`VALIDATION_FAILED: ${path}: ${message}`);
}
