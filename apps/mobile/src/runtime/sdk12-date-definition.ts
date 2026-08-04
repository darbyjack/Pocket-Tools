import {
  validateMiniAppDefinition,
  type MiniAppDefinition,
  type ValidationIssue,
} from "@pocket-tools/sdk-contract";

import type {
  CollectionDefinition,
  FieldDefinition,
  MiniAppInspection,
  MiniAppManifest,
  SettingDefinition,
} from "../model.ts";
import {
  compareCanonicalTemporalValues,
  isCanonicalDate,
  isCanonicalDateTime,
} from "./date-values.ts";

type PlainObject = Record<string, unknown>;

interface DormantDefinitionInput {
  readonly manifest: PlainObject;
  readonly settings: PlainObject;
  readonly collections: PlainObject;
  readonly screens: readonly string[];
  readonly actions: readonly string[];
}

export function validateDormantSdk12Definition(
  input: DormantDefinitionInput,
): { readonly inspection?: MiniAppInspection; readonly issues: readonly ValidationIssue[] } {
  const issues: ValidationIssue[] = [];
  const normalizedSettings: Record<string, SettingDefinition> = {};
  const transformedSettings: Record<string, unknown> = {};

  for (const [name, rawValue] of Object.entries(input.settings)) {
    const path = `settings.${name}`;
    const value = asObject(rawValue);
    if (value === null || (value.type !== "date" && value.type !== "datetime")) {
      normalizedSettings[name] = rawValue as SettingDefinition;
      transformedSettings[name] = rawValue;
      continue;
    }

    exactKeys(
      value,
      ["type", "label", "description", "default", "visibleWhen", "min", "max"],
      path,
      issues,
    );
    validateTemporalDefinition(value, path, value.type, true, issues);
    normalizedSettings[name] = {
      ...value,
      hostSdkVersion: "1.2",
    } as unknown as SettingDefinition;
    transformedSettings[name] = transformTemporalSetting(value);
  }

  const normalizedCollections: Record<string, CollectionDefinition> = {};
  const transformedCollections: Record<string, unknown> = {};
  for (const [collectionName, rawCollection] of Object.entries(input.collections)) {
    const collectionPath = `collections.${collectionName}`;
    const collection = asObject(rawCollection);
    if (collection === null) {
      normalizedCollections[collectionName] = rawCollection as CollectionDefinition;
      transformedCollections[collectionName] = rawCollection;
      continue;
    }

    const rawFields = asObject(collection.fields);
    if (rawFields === null) {
      normalizedCollections[collectionName] = rawCollection as CollectionDefinition;
      transformedCollections[collectionName] = rawCollection;
      continue;
    }

    const normalizedFields: Record<string, FieldDefinition> = {};
    const transformedFields: Record<string, unknown> = {};
    for (const [fieldName, rawField] of Object.entries(rawFields)) {
      const fieldPath = `${collectionPath}.fields.${fieldName}`;
      const field = asObject(rawField);
      if (field === null || (field.type !== "date" && field.type !== "datetime")) {
        normalizedFields[fieldName] = rawField as FieldDefinition;
        transformedFields[fieldName] = rawField;
        continue;
      }

      exactKeys(field, ["type", "optional", "min", "max"], fieldPath, issues);
      validateTemporalDefinition(field, fieldPath, field.type, false, issues);
      normalizedFields[fieldName] = {
        ...field,
        hostSdkVersion: "1.2",
      } as unknown as FieldDefinition;
      transformedFields[fieldName] = transformTemporalField(field);
    }

    normalizedCollections[collectionName] = {
      ...collection,
      fields: normalizedFields,
    } as CollectionDefinition;
    transformedCollections[collectionName] = {
      ...collection,
      fields: transformedFields,
    };
  }

  const dummyPage = { type: "page" as const, title: "Validation", children: [] };
  const transformedDefinition = {
    manifest: { ...input.manifest, sdkVersion: "1.1" },
    settings: transformedSettings,
    collections: transformedCollections,
    screens: Object.fromEntries(input.screens.map((name) => [name, () => dummyPage])),
    actions: Object.fromEntries(input.actions.map((name) => [name, () => undefined])),
  } as unknown as MiniAppDefinition;
  issues.push(...validateMiniAppDefinition(transformedDefinition));

  if (issues.length > 0) return { issues };
  return {
    issues,
    inspection: {
      manifest: input.manifest as unknown as MiniAppManifest,
      settings: normalizedSettings,
      collections: normalizedCollections,
      screens: input.screens,
      actions: input.actions,
    },
  };
}

function validateTemporalDefinition(
  value: PlainObject,
  path: string,
  type: "date" | "datetime",
  hasDefault: boolean,
  issues: ValidationIssue[],
): void {
  const validator = type === "date" ? isCanonicalDate : isCanonicalDateTime;
  const description =
    type === "date"
      ? "a canonical YYYY-MM-DD date"
      : "a canonical UTC date-time with millisecond precision";

  for (const name of hasDefault ? ["default", "min", "max"] : ["min", "max"]) {
    const candidate = value[name];
    if (candidate !== undefined && !validator(candidate)) {
      addIssue(issues, `${path}.${name}`, `Must be ${description}.`);
    }
  }

  const minimum = typeof value.min === "string" && validator(value.min) ? value.min : undefined;
  const maximum = typeof value.max === "string" && validator(value.max) ? value.max : undefined;
  const defaultValue =
    typeof value.default === "string" && validator(value.default) ? value.default : undefined;

  if (
    minimum !== undefined &&
    maximum !== undefined &&
    compareCanonicalTemporalValues(minimum, maximum) > 0
  ) {
    addIssue(issues, path, "Minimum cannot exceed maximum.");
  }
  if (
    defaultValue !== undefined &&
    minimum !== undefined &&
    compareCanonicalTemporalValues(defaultValue, minimum) < 0
  ) {
    addIssue(issues, `${path}.default`, "Must not be below the declared minimum.");
  }
  if (
    defaultValue !== undefined &&
    maximum !== undefined &&
    compareCanonicalTemporalValues(defaultValue, maximum) > 0
  ) {
    addIssue(issues, `${path}.default`, "Must not exceed the declared maximum.");
  }
}

function transformTemporalSetting(value: PlainObject): PlainObject {
  const { min: _minimum, max: _maximum, type: _type, ...common } = value;
  return { ...common, type: "text" };
}

function transformTemporalField(value: PlainObject): PlainObject {
  const { min: _minimum, max: _maximum, type, ...common } = value;
  return type === "date" ? { ...common, type: "text" } : { ...common, type: "datetime" };
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

function asObject(value: unknown): PlainObject | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null ? (value as PlainObject) : null;
}

function addIssue(issues: ValidationIssue[], path: string, message: string): void {
  issues.push({ path, message });
}
