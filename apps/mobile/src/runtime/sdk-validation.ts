import type {
  CollectionDefinition,
  FieldDefinition,
  MiniAppInspection,
  SerializableValue,
  SettingDefinition,
} from "../model.ts";
import {
  compareCanonicalTemporalValues,
  isCanonicalDate,
  isCanonicalDateTime,
} from "./date-values.ts";
import { assertCanonicalMultiSelectValue } from "./sdk12-multiselect.ts";

const RECORD_ID_PATTERN = /^[a-f0-9]{32}$/;
const RESERVED_RECORD_FIELDS = new Set(["id", "createdAt", "updatedAt"]);

type RecordInput = Readonly<Record<string, SerializableValue>>;
type SdkVersion = MiniAppInspection["manifest"]["sdkVersion"];

export function assertSettingValue(
  definition: SettingDefinition,
  value: SerializableValue,
  path: string,
  sdkVersion?: SdkVersion,
): void {
  switch (definition.type) {
    case "text":
      if (typeof value !== "string") fail(path, "Expected text.");
      if (value.length < (definition.minLength ?? 0))
        fail(path, "Text is shorter than the minimum length.");
      if (value.length > (definition.maxLength ?? 10_000))
        fail(path, "Text exceeds the maximum length.");
      return;
    case "boolean":
      if (typeof value !== "boolean") fail(path, "Expected a boolean.");
      return;
    case "number":
    case "money":
      if (typeof value !== "number" || !Number.isFinite(value))
        fail(path, "Expected a finite number.");
      if (definition.min !== undefined && value < definition.min)
        fail(path, "Value is below the minimum.");
      if (definition.max !== undefined && value > definition.max)
        fail(path, "Value exceeds the maximum.");
      return;
    case "select":
      if (!definition.options.some((option) => option.value === value)) {
        fail(path, "Value is not one of the declared options.");
      }
      return;
    case "multi-select":
      requireSdk12(sdkVersion ?? "1.2", path, "Multi-select settings");
      assertCanonicalMultiSelectValue(definition, value, path);
      return;
    case "date":
      requireSdk12(sdkVersion ?? "1.2", path, "Date settings");
      assertTemporalValue(definition, value, path, "date");
      return;
    case "datetime":
      requireSdk12(sdkVersion ?? "1.2", path, "Date-time settings");
      assertTemporalValue(definition, value, path, "datetime");
  }
}

export function assertRecordInput(
  definition: CollectionDefinition,
  value: RecordInput,
  path: string,
  partial = false,
  sdkVersion?: SdkVersion,
): void {
  const fieldNames = new Set(Object.keys(definition.fields));
  const entries = Object.entries(value);
  if (partial && entries.length === 0) fail(path, "At least one field must be updated.");

  for (const [name, fieldValue] of entries) {
    if (RESERVED_RECORD_FIELDS.has(name)) fail(`${path}.${name}`, "Record metadata is host-owned.");
    if (!fieldNames.has(name)) fail(`${path}.${name}`, "Unknown collection field.");
    assertFieldValue(definition.fields[name]!, fieldValue, `${path}.${name}`, sdkVersion);
  }

  if (!partial) {
    for (const [name, field] of Object.entries(definition.fields)) {
      if (!field.optional && !(name in value))
        fail(`${path}.${name}`, "Required field is missing.");
    }
  }
}

export function assertRecordId(id: string, path: string): void {
  if (!RECORD_ID_PATTERN.test(id))
    fail(path, "Expected a 32-character lowercase hexadecimal record ID.");
}

function assertFieldValue(
  definition: FieldDefinition,
  value: SerializableValue,
  path: string,
  sdkVersion?: SdkVersion,
): void {
  if (value === null) {
    if (!definition.optional) fail(path, "Required fields cannot be null.");
    return;
  }

  const effectiveVersion = resolveFieldVersion(definition, sdkVersion);
  switch (definition.type) {
    case "text":
      if (typeof value !== "string") fail(path, "Expected text.");
      if (value.length < (definition.minLength ?? 0))
        fail(path, "Text is shorter than the minimum length.");
      if (value.length > (definition.maxLength ?? 100_000))
        fail(path, "Text exceeds the maximum length.");
      return;
    case "boolean":
      if (typeof value !== "boolean") fail(path, "Expected a boolean.");
      return;
    case "number":
    case "money":
      if (typeof value !== "number" || !Number.isFinite(value))
        fail(path, "Expected a finite number.");
      if (definition.min !== undefined && value < definition.min)
        fail(path, "Value is below the minimum.");
      if (definition.max !== undefined && value > definition.max)
        fail(path, "Value exceeds the maximum.");
      return;
    case "date":
      requireSdk12(effectiveVersion, path, "Date fields");
      assertTemporalValue(definition, value, path, "date");
      return;
    case "datetime":
      if (effectiveVersion !== "1.2") {
        if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
          fail(path, "Expected an ISO-compatible date-time string.");
        }
        return;
      }
      assertTemporalValue(definition, value, path, "datetime");
  }
}

function assertTemporalValue(
  definition: { readonly min?: string; readonly max?: string },
  value: SerializableValue,
  path: string,
  type: "date" | "datetime",
): void {
  const valid = type === "date" ? isCanonicalDate(value) : isCanonicalDateTime(value);
  if (!valid) {
    fail(
      path,
      type === "date"
        ? "Expected a canonical YYYY-MM-DD date."
        : "Expected a canonical UTC date-time with millisecond precision.",
    );
  }

  const text = value as string;
  if (definition.min !== undefined && compareCanonicalTemporalValues(text, definition.min) < 0) {
    fail(path, "Value is below the minimum.");
  }
  if (definition.max !== undefined && compareCanonicalTemporalValues(text, definition.max) > 0) {
    fail(path, "Value exceeds the maximum.");
  }
}

function resolveFieldVersion(
  definition: FieldDefinition,
  explicit: SdkVersion | undefined,
): SdkVersion {
  if (explicit !== undefined) return explicit;
  if (definition.type === "date") return "1.2";
  return "hostSdkVersion" in definition && definition.hostSdkVersion === "1.2" ? "1.2" : "1.1";
}

function requireSdk12(sdkVersion: SdkVersion, path: string, capability: string): void {
  if (sdkVersion !== "1.2") fail(path, `${capability} require SDK 1.2.`);
}

function fail(path: string, message: string): never {
  throw new Error(`VALIDATION_FAILED: ${path}: ${message}`);
}
