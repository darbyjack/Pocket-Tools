import type { FieldDefinition } from "./data.ts";
import type { MiniAppDefinition } from "./core.ts";
import { SDK_VERSION } from "./core.ts";
import type { SettingDefinition, SelectValue } from "./settings.ts";

export interface ValidationIssue {
  readonly path: string;
  readonly message: string;
}

const appIdPattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const objectKeyPattern = /^[a-z][A-Za-z0-9]*$/;

type PlainObject = Record<string, unknown>;

export function validateMiniAppDefinition(
  definition: MiniAppDefinition,
): readonly ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const root = asObject(definition, "definition", issues);
  if (root === null) return issues;

  exactKeys(root, ["manifest", "settings", "collections", "screens", "actions"], "definition", issues);
  validateManifest(root.manifest, issues);

  const settings = validateNamedObject(root.settings, "settings", issues);
  const collections = validateNamedObject(root.collections, "collections", issues);
  const screens = validateNamedObject(root.screens, "screens", issues, true);
  const actions = validateNamedObject(root.actions, "actions", issues);

  if (Object.keys(screens).length === 0) {
    addIssue(issues, "screens", "At least one screen is required.");
  }
  if (!("home" in screens)) {
    addIssue(issues, "screens.home", "A home screen is required.");
  }
  for (const [name, renderer] of Object.entries(screens)) {
    if (typeof renderer !== "function") {
      addIssue(issues, `screens.${name}`, "Must be a synchronous screen function.");
    }
  }
  for (const [name, action] of Object.entries(actions)) {
    if (typeof action !== "function") {
      addIssue(issues, `actions.${name}`, "Must be a synchronous action function.");
    }
  }

  for (const [name, value] of Object.entries(settings)) {
    validateSetting(name, value, settings, issues);
  }
  for (const [name, value] of Object.entries(collections)) {
    validateCollection(name, value, issues);
  }

  return issues;
}

function validateManifest(value: unknown, issues: ValidationIssue[]): void {
  const manifest = asObject(value, "manifest", issues);
  if (manifest === null) return;
  exactKeys(manifest, ["id", "name", "description", "icon", "sdkVersion"], "manifest", issues);

  if (typeof manifest.id !== "string" || !appIdPattern.test(manifest.id)) {
    addIssue(issues, "manifest.id", "Must use lowercase kebab-case and begin with a letter.");
  }
  validateString(manifest.name, "manifest.name", 1, 80, issues);
  validateOptionalString(manifest.description, "manifest.description", 0, 500, issues);
  validateOptionalString(manifest.icon, "manifest.icon", 1, 80, issues);
  if (manifest.sdkVersion !== SDK_VERSION) {
    addIssue(
      issues,
      "manifest.sdkVersion",
      `SDK version ${String(manifest.sdkVersion)} is not supported; use ${SDK_VERSION}.`,
    );
  }
}

function validateNamedObject(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
  required = false,
): PlainObject {
  if (value === undefined && !required) return {};
  const object = asObject(value, path, issues);
  if (object === null) return {};
  for (const key of Object.keys(object)) {
    if (!objectKeyPattern.test(key)) {
      addIssue(issues, `${path}.${key}`, "Use a lower camelCase identifier that begins with a letter.");
    }
  }
  return object;
}

function validateSetting(
  name: string,
  value: unknown,
  allSettings: PlainObject,
  issues: ValidationIssue[],
): void {
  const path = `settings.${name}`;
  const setting = asObject(value, path, issues);
  if (setting === null) return;
  const type = setting.type;

  const common = ["type", "label", "description", "default", "visibleWhen"];
  if (type === "text") {
    exactKeys(setting, [...common, "minLength", "maxLength"], path, issues);
  } else if (type === "boolean") {
    exactKeys(setting, common, path, issues);
  } else if (type === "number") {
    exactKeys(setting, [...common, "min", "max", "step"], path, issues);
  } else if (type === "money") {
    exactKeys(setting, [...common, "min", "max"], path, issues);
  } else if (type === "select") {
    exactKeys(setting, [...common, "options"], path, issues);
  } else {
    addIssue(issues, `${path}.type`, "Unsupported setting type.");
    return;
  }

  validateString(setting.label, `${path}.label`, 1, 120, issues);
  validateOptionalString(setting.description, `${path}.description`, 0, 500, issues);
  validateVisibility(setting.visibleWhen, `${path}.visibleWhen`, allSettings, issues);

  if (type === "text") {
    validateIntegerBound(setting.minLength, `${path}.minLength`, 0, 10_000, issues);
    validateIntegerBound(setting.maxLength, `${path}.maxLength`, 1, 10_000, issues);
    if (typeof setting.default !== "string") {
      addIssue(issues, `${path}.default`, "Must be a string.");
    } else {
      const minimum = numberOr(setting.minLength, 0);
      const maximum = numberOr(setting.maxLength, 10_000);
      if (setting.default.length < minimum || setting.default.length > maximum) {
        addIssue(issues, `${path}.default`, "Must satisfy the declared text length bounds.");
      }
    }
    validateOrderedBounds(setting.minLength, setting.maxLength, path, issues);
    return;
  }

  if (type === "boolean") {
    if (typeof setting.default !== "boolean") {
      addIssue(issues, `${path}.default`, "Must be a boolean.");
    }
    return;
  }

  if (type === "number" || type === "money") {
    validateFinite(setting.default, `${path}.default`, issues);
    validateOptionalFinite(setting.min, `${path}.min`, issues);
    validateOptionalFinite(setting.max, `${path}.max`, issues);
    if (type === "number") {
      validateOptionalFinite(setting.step, `${path}.step`, issues);
      if (typeof setting.step === "number" && setting.step <= 0) {
        addIssue(issues, `${path}.step`, "Must be greater than zero.");
      }
    }
    validateOrderedBounds(setting.min, setting.max, path, issues);
    if (
      typeof setting.default === "number" &&
      Number.isFinite(setting.default) &&
      ((typeof setting.min === "number" && setting.default < setting.min) ||
        (typeof setting.max === "number" && setting.default > setting.max))
    ) {
      addIssue(issues, `${path}.default`, "Must satisfy the declared numeric bounds.");
    }
    return;
  }

  const options = Array.isArray(setting.options) ? setting.options : null;
  if (options === null || options.length === 0 || options.length > 100) {
    addIssue(issues, `${path}.options`, "Must contain between 1 and 100 options.");
    return;
  }

  const optionValues: SelectValue[] = [];
  const seen = new Set<string>();
  for (const [index, optionValue] of options.entries()) {
    const optionPath = `${path}.options[${index}]`;
    const option = asObject(optionValue, optionPath, issues);
    if (option === null) continue;
    exactKeys(option, ["label", "value"], optionPath, issues);
    validateString(option.label, `${optionPath}.label`, 1, 120, issues);
    if (!isSelectValue(option.value)) {
      addIssue(issues, `${optionPath}.value`, "Must be a string, number, or boolean.");
      continue;
    }
    if (typeof option.value === "number" && !Number.isFinite(option.value)) {
      addIssue(issues, `${optionPath}.value`, "Must be finite.");
      continue;
    }
    const key = `${typeof option.value}:${String(option.value)}`;
    if (seen.has(key)) {
      addIssue(issues, `${optionPath}.value`, "Option values must be unique.");
    }
    seen.add(key);
    optionValues.push(option.value);
  }
  if (!isSelectValue(setting.default) || !optionValues.some((value) => value === setting.default)) {
    addIssue(issues, `${path}.default`, "Must exactly match one declared option value.");
  }
}

function validateVisibility(
  value: unknown,
  path: string,
  settings: PlainObject,
  issues: ValidationIssue[],
): void {
  if (value === undefined) return;
  const rule = asObject(value, path, issues);
  if (rule === null) return;
  exactKeys(rule, ["setting", "equals"], path, issues);
  if (typeof rule.setting !== "string" || !objectKeyPattern.test(rule.setting)) {
    addIssue(issues, `${path}.setting`, "Must name a lower camelCase setting.");
  } else if (!(rule.setting in settings)) {
    addIssue(issues, `${path}.setting`, "Must reference a declared setting.");
  }
  if (!isSelectValue(rule.equals) || (typeof rule.equals === "number" && !Number.isFinite(rule.equals))) {
    addIssue(issues, `${path}.equals`, "Must be a finite string, number, or boolean value.");
  }
}

function validateCollection(name: string, value: unknown, issues: ValidationIssue[]): void {
  const path = `collections.${name}`;
  const collection = asObject(value, path, issues);
  if (collection === null) return;
  exactKeys(collection, ["fields"], path, issues);
  const fields = asObject(collection.fields, `${path}.fields`, issues);
  if (fields === null) return;
  if (Object.keys(fields).length === 0) {
    addIssue(issues, `${path}.fields`, "At least one field is required.");
  }
  for (const [fieldName, fieldValue] of Object.entries(fields)) {
    if (!objectKeyPattern.test(fieldName)) {
      addIssue(issues, `${path}.fields.${fieldName}`, "Use a lower camelCase identifier.");
    }
    validateField(fieldValue, `${path}.fields.${fieldName}`, issues);
  }
}

function validateField(value: unknown, path: string, issues: ValidationIssue[]): void {
  const field = asObject(value, path, issues) as (PlainObject & Partial<FieldDefinition>) | null;
  if (field === null) return;
  const type = field.type;
  if (type === "text") {
    exactKeys(field, ["type", "optional", "minLength", "maxLength"], path, issues);
    validateIntegerBound(field.minLength, `${path}.minLength`, 0, 100_000, issues);
    validateIntegerBound(field.maxLength, `${path}.maxLength`, 1, 100_000, issues);
    validateOrderedBounds(field.minLength, field.maxLength, path, issues);
  } else if (type === "boolean" || type === "datetime") {
    exactKeys(field, ["type", "optional"], path, issues);
  } else if (type === "number" || type === "money") {
    exactKeys(field, ["type", "optional", "min", "max"], path, issues);
    validateOptionalFinite(field.min, `${path}.min`, issues);
    validateOptionalFinite(field.max, `${path}.max`, issues);
    validateOrderedBounds(field.min, field.max, path, issues);
  } else {
    addIssue(issues, `${path}.type`, "Unsupported collection field type.");
    return;
  }
  if (field.optional !== undefined && typeof field.optional !== "boolean") {
    addIssue(issues, `${path}.optional`, "Must be a boolean.");
  }
}

function asObject(value: unknown, path: string, issues: ValidationIssue[]): PlainObject | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    addIssue(issues, path, "Must be a plain object.");
    return null;
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    addIssue(issues, path, "Must be a plain object.");
    return null;
  }
  return value as PlainObject;
}

function exactKeys(
  object: PlainObject,
  allowed: readonly string[],
  path: string,
  issues: ValidationIssue[],
): void {
  const allowedKeys = new Set(allowed);
  for (const key of Object.keys(object)) {
    if (!allowedKeys.has(key)) addIssue(issues, `${path}.${key}`, "Unknown property.");
  }
}

function validateString(
  value: unknown,
  path: string,
  minimum: number,
  maximum: number,
  issues: ValidationIssue[],
): void {
  if (typeof value !== "string" || value.length < minimum || value.length > maximum) {
    addIssue(issues, path, `Must be a string from ${minimum} to ${maximum} characters.`);
  }
}

function validateOptionalString(
  value: unknown,
  path: string,
  minimum: number,
  maximum: number,
  issues: ValidationIssue[],
): void {
  if (value !== undefined) validateString(value, path, minimum, maximum, issues);
}

function validateFinite(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    addIssue(issues, path, "Must be a finite number.");
  }
}

function validateOptionalFinite(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (value !== undefined) validateFinite(value, path, issues);
}

function validateIntegerBound(
  value: unknown,
  path: string,
  minimum: number,
  maximum: number,
  issues: ValidationIssue[],
): void {
  if (
    value !== undefined &&
    (!Number.isInteger(value) || (value as number) < minimum || (value as number) > maximum)
  ) {
    addIssue(issues, path, `Must be an integer from ${minimum} to ${maximum}.`);
  }
}

function validateOrderedBounds(
  minimum: unknown,
  maximum: unknown,
  path: string,
  issues: ValidationIssue[],
): void {
  if (typeof minimum === "number" && typeof maximum === "number" && minimum > maximum) {
    addIssue(issues, path, "Minimum cannot exceed maximum.");
  }
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function isSelectValue(value: unknown): value is SelectValue {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

function addIssue(issues: ValidationIssue[], path: string, message: string): void {
  issues.push({ path, message });
}

export function assertValidMiniAppDefinition(definition: MiniAppDefinition): void {
  const issues = validateMiniAppDefinition(definition);
  if (issues.length === 0) return;
  const details = issues.map((issue) => `${issue.path}: ${issue.message}`).join("\n");
  throw new Error(`Mini app definition is invalid:\n${details}`);
}
