import type { FieldDefinition } from "./data.ts";
import type { MiniAppDefinition, SdkVersion } from "./core.ts";
import { normalizeSdkVersion, SDK_VERSION, SUPPORTED_SDK_VERSIONS } from "./core.ts";
import type { SelectValue } from "./settings.ts";

export interface ValidationIssue {
  readonly path: string;
  readonly message: string;
}

const appIdPattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const objectKeyPattern = /^[a-z][A-Za-z0-9]*$/;
const reservedRecordFields = new Set(["id", "createdAt", "updatedAt"]);

type PlainObject = Record<string, unknown>;

export function validateMiniAppDefinition(
  definition: MiniAppDefinition,
): readonly ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const root = asObject(definition, "definition", issues);
  if (root === null) return issues;

  exactKeys(
    root,
    ["manifest", "settings", "collections", "screens", "actions"],
    "definition",
    issues,
  );
  const sdkVersion = validateManifest(root.manifest, issues);

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
    validateSetting(name, value, settings, sdkVersion, issues);
  }
  for (const [name, value] of Object.entries(collections)) {
    validateCollection(name, value, sdkVersion, issues);
  }

  return issues;
}

function validateManifest(value: unknown, issues: ValidationIssue[]): SdkVersion | null {
  const manifest = asObject(value, "manifest", issues);
  if (manifest === null) return null;
  exactKeys(manifest, ["id", "name", "description", "icon", "sdkVersion"], "manifest", issues);

  if (typeof manifest.id !== "string" || !appIdPattern.test(manifest.id)) {
    addIssue(issues, "manifest.id", "Must use lowercase kebab-case and begin with a letter.");
  }
  validateString(manifest.name, "manifest.name", 1, 80, issues);
  validateOptionalString(manifest.description, "manifest.description", 0, 500, issues);
  validateOptionalString(manifest.icon, "manifest.icon", 1, 80, issues);

  const sdkVersion = normalizeSdkVersion(manifest.sdkVersion);
  if (sdkVersion === null) {
    addIssue(
      issues,
      "manifest.sdkVersion",
      `SDK version ${String(manifest.sdkVersion)} is not supported; use ${SUPPORTED_SDK_VERSIONS.join(
        " or ",
      )}. The latest version is ${SDK_VERSION}.`,
    );
  }
  return sdkVersion;
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
      addIssue(
        issues,
        `${path}.${key}`,
        "Use a lower camelCase identifier that begins with a letter.",
      );
    }
  }
  return object;
}

function validateSetting(
  name: string,
  value: unknown,
  allSettings: PlainObject,
  sdkVersion: SdkVersion | null,
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
  } else if (type === "number" || type === "money") {
    exactKeys(setting, [...common, "min", "max"], path, issues);
  } else if (type === "select") {
    exactKeys(setting, [...common, "options"], path, issues);
  } else if (type === "date" || type === "datetime") {
    exactKeys(setting, [...common, "min", "max"], path, issues);
    requireSdk12(sdkVersion, `${path}.type`, issues);
  } else if (type === "multi-select") {
    exactKeys(setting, [...common, "options", "minSelections", "maxSelections"], path, issues);
    requireSdk12(sdkVersion, `${path}.type`, issues);
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
    validateOrderedNumericBounds(setting.minLength, setting.maxLength, path, issues);
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
    validateOrderedNumericBounds(setting.min, setting.max, path, issues);
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

  if (type === "date" || type === "datetime") {
    const isValid = type === "date" ? isCanonicalDate : isCanonicalDateTime;
    validateCanonicalTemporal(setting.default, `${path}.default`, type, isValid, issues);
    validateOptionalCanonicalTemporal(setting.min, `${path}.min`, type, isValid, issues);
    validateOptionalCanonicalTemporal(setting.max, `${path}.max`, type, isValid, issues);
    validateOrderedStringBounds(setting.min, setting.max, path, issues);
    if (
      typeof setting.default === "string" &&
      isValid(setting.default) &&
      ((typeof setting.min === "string" && setting.default < setting.min) ||
        (typeof setting.max === "string" && setting.default > setting.max))
    ) {
      addIssue(issues, `${path}.default`, "Must satisfy the declared temporal bounds.");
    }
    return;
  }

  const optionValues = validateOptions(setting.options, `${path}.options`, issues);
  if (type === "select") {
    if (
      !isSelectValue(setting.default) ||
      !optionValues.some((entry) => entry === setting.default)
    ) {
      addIssue(issues, `${path}.default`, "Must exactly match one declared option value.");
    }
    return;
  }

  validateIntegerBound(
    setting.minSelections,
    `${path}.minSelections`,
    0,
    optionValues.length,
    issues,
  );
  validateIntegerBound(
    setting.maxSelections,
    `${path}.maxSelections`,
    0,
    optionValues.length,
    issues,
  );
  validateOrderedNumericBounds(setting.minSelections, setting.maxSelections, path, issues);

  if (!Array.isArray(setting.default)) {
    addIssue(issues, `${path}.default`, "Must be an array of declared option values.");
    return;
  }
  const seen = new Set<string>();
  const defaultValues: SelectValue[] = [];
  for (const [index, entry] of setting.default.entries()) {
    if (!isSelectValue(entry) || (typeof entry === "number" && !Number.isFinite(entry))) {
      addIssue(issues, `${path}.default[${index}]`, "Must be a finite declared option value.");
      continue;
    }
    const key = selectValueKey(entry);
    if (seen.has(key)) {
      addIssue(issues, `${path}.default[${index}]`, "Selections must be unique.");
    }
    seen.add(key);
    if (!optionValues.some((option) => option === entry)) {
      addIssue(issues, `${path}.default[${index}]`, "Must match a declared option value.");
    }
    defaultValues.push(entry);
  }
  const expectedOrder = optionValues.filter((option) =>
    defaultValues.some((selected) => selected === option),
  );
  if (!expectedOrder.every((entry, index) => entry === defaultValues[index])) {
    addIssue(issues, `${path}.default`, "Must preserve option declaration order.");
  }
  const minimum = numberOr(setting.minSelections, 0);
  const maximum = numberOr(setting.maxSelections, optionValues.length);
  if (defaultValues.length < minimum || defaultValues.length > maximum) {
    addIssue(issues, `${path}.default`, "Must satisfy the declared selection bounds.");
  }
}

function validateOptions(value: unknown, path: string, issues: ValidationIssue[]): SelectValue[] {
  const options = Array.isArray(value) ? value : null;
  if (options === null || options.length === 0 || options.length > 100) {
    addIssue(issues, path, "Must contain between 1 and 100 options.");
    return [];
  }

  const values: SelectValue[] = [];
  const seen = new Set<string>();
  for (const [index, optionValue] of options.entries()) {
    const optionPath = `${path}[${index}]`;
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
    const key = selectValueKey(option.value);
    if (seen.has(key)) {
      addIssue(issues, `${optionPath}.value`, "Option values must be unique.");
    }
    seen.add(key);
    values.push(option.value);
  }
  return values;
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
  } else {
    const target = settings[rule.setting];
    if (isPlainObject(target) && target.type === "multi-select") {
      addIssue(issues, `${path}.setting`, "Cannot reference a multi-select setting.");
    }
  }
  if (
    !isSelectValue(rule.equals) ||
    (typeof rule.equals === "number" && !Number.isFinite(rule.equals))
  ) {
    addIssue(issues, `${path}.equals`, "Must be a finite string, number, or boolean value.");
  }
}

function validateCollection(
  name: string,
  value: unknown,
  sdkVersion: SdkVersion | null,
  issues: ValidationIssue[],
): void {
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
    const fieldPath = `${path}.fields.${fieldName}`;
    if (!objectKeyPattern.test(fieldName)) {
      addIssue(issues, fieldPath, "Use a lower camelCase identifier.");
    }
    if (reservedRecordFields.has(fieldName)) {
      addIssue(issues, fieldPath, "This record metadata name is reserved for the host.");
    }
    validateField(fieldValue, fieldPath, sdkVersion, issues);
  }
}

function validateField(
  value: unknown,
  path: string,
  sdkVersion: SdkVersion | null,
  issues: ValidationIssue[],
): void {
  const field = asObject(value, path, issues) as (PlainObject & Partial<FieldDefinition>) | null;
  if (field === null) return;
  const type = field.type;

  if (type === "text") {
    exactKeys(field, ["type", "optional", "minLength", "maxLength"], path, issues);
    validateIntegerBound(field.minLength, `${path}.minLength`, 0, 100_000, issues);
    validateIntegerBound(field.maxLength, `${path}.maxLength`, 1, 100_000, issues);
    validateOrderedNumericBounds(field.minLength, field.maxLength, path, issues);
  } else if (type === "boolean") {
    exactKeys(field, ["type", "optional"], path, issues);
  } else if (type === "number" || type === "money") {
    exactKeys(field, ["type", "optional", "min", "max"], path, issues);
    validateOptionalFinite(field.min, `${path}.min`, issues);
    validateOptionalFinite(field.max, `${path}.max`, issues);
    validateOrderedNumericBounds(field.min, field.max, path, issues);
  } else if (type === "date" || type === "datetime") {
    exactKeys(field, ["type", "optional", "min", "max"], path, issues);
    if (type === "date" || field.min !== undefined || field.max !== undefined) {
      requireSdk12(sdkVersion, `${path}.type`, issues);
    }
    const isValid = type === "date" ? isCanonicalDate : isCanonicalDateTime;
    validateOptionalCanonicalTemporal(field.min, `${path}.min`, type, isValid, issues);
    validateOptionalCanonicalTemporal(field.max, `${path}.max`, type, isValid, issues);
    validateOrderedStringBounds(field.min, field.max, path, issues);
  } else {
    addIssue(issues, `${path}.type`, "Unsupported collection field type.");
    return;
  }

  if (field.optional !== undefined && typeof field.optional !== "boolean") {
    addIssue(issues, `${path}.optional`, "Must be a boolean.");
  }
}

function requireSdk12(
  sdkVersion: SdkVersion | null,
  path: string,
  issues: ValidationIssue[],
): void {
  if (sdkVersion !== "1.2") {
    addIssue(issues, path, "Requires SDK 1.2.");
  }
}

function asObject(value: unknown, path: string, issues: ValidationIssue[]): PlainObject | null {
  if (!isPlainObject(value)) {
    addIssue(issues, path, "Must be a plain object.");
    return null;
  }
  return value;
}

function isPlainObject(value: unknown): value is PlainObject {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactKeys(
  object: PlainObject,
  allowed: readonly string[],
  path: string,
  issues: ValidationIssue[],
): void {
  const allowedKeys = new Set(allowed);
  for (const key of Object.keys(object)) {
    if (!allowedKeys.has(key)) {
      addIssue(issues, `${path}.${key}`, "Unknown property.");
    }
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

function validateOrderedNumericBounds(
  minimum: unknown,
  maximum: unknown,
  path: string,
  issues: ValidationIssue[],
): void {
  if (typeof minimum === "number" && typeof maximum === "number" && minimum > maximum) {
    addIssue(issues, path, "Minimum cannot exceed maximum.");
  }
}

function validateOrderedStringBounds(
  minimum: unknown,
  maximum: unknown,
  path: string,
  issues: ValidationIssue[],
): void {
  if (typeof minimum === "string" && typeof maximum === "string" && minimum > maximum) {
    addIssue(issues, path, "Minimum cannot exceed maximum.");
  }
}

function validateCanonicalTemporal(
  value: unknown,
  path: string,
  type: "date" | "datetime",
  validator: (value: string) => boolean,
  issues: ValidationIssue[],
): void {
  if (typeof value !== "string" || !validator(value)) {
    addIssue(
      issues,
      path,
      type === "date"
        ? "Must be a valid date in YYYY-MM-DD form."
        : "Must be a canonical UTC date-time in YYYY-MM-DDTHH:mm:ss.sssZ form.",
    );
  }
}

function validateOptionalCanonicalTemporal(
  value: unknown,
  path: string,
  type: "date" | "datetime",
  validator: (value: string) => boolean,
  issues: ValidationIssue[],
): void {
  if (value !== undefined) validateCanonicalTemporal(value, path, type, validator, issues);
}

function isCanonicalDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
}

function isCanonicalDateTime(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function isSelectValue(value: unknown): value is SelectValue {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

function selectValueKey(value: SelectValue): string {
  return `${typeof value}:${String(value)}`;
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
