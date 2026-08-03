import type { CollectionDefinition, SerializableValue, SettingDefinition } from "../model.ts";

const RECORD_ID_PATTERN = /^[a-f0-9]{32}$/;
const RESERVED_RECORD_FIELDS = new Set(["id", "createdAt", "updatedAt"]);

type RecordInput = Readonly<Record<string, SerializableValue>>;

export function assertSettingValue(
  definition: SettingDefinition,
  value: SerializableValue,
  path: string,
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
  }
}

export function assertRecordInput(
  definition: CollectionDefinition,
  value: RecordInput,
  path: string,
  partial = false,
): void {
  const fieldNames = new Set(Object.keys(definition.fields));
  const entries = Object.entries(value);
  if (partial && entries.length === 0) fail(path, "At least one field must be updated.");

  for (const [name, fieldValue] of entries) {
    if (RESERVED_RECORD_FIELDS.has(name)) fail(`${path}.${name}`, "Record metadata is host-owned.");
    if (!fieldNames.has(name)) fail(`${path}.${name}`, "Unknown collection field.");
    assertFieldValue(definition.fields[name]!, fieldValue, `${path}.${name}`);
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
  definition: CollectionDefinition["fields"][string],
  value: SerializableValue,
  path: string,
): void {
  if (value === null) {
    if (!definition.optional) fail(path, "Required fields cannot be null.");
    return;
  }

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
    case "datetime":
      if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
        fail(path, "Expected an ISO-compatible date-time string.");
      }
  }
}

function fail(path: string, message: string): never {
  throw new Error(`VALIDATION_FAILED: ${path}: ${message}`);
}
