import type {
  MiniAppInspection,
  PageNode,
  SettingDefinition,
} from "../model.ts";
import { validatePageNode, type UiValidationOptions } from "./ui-validation.ts";

type PlainObject = Record<string, unknown>;

export function validatePageNodeWithDormantFormHints(
  value: unknown,
  inspection?: MiniAppInspection,
  options: UiValidationOptions = {},
): asserts value is PageNode {
  const legacyCompatible = stripAndValidateFormHints(value, inspection, options);
  validatePageNode(legacyCompatible, legacyInspection(inspection), options);
}

export function validatePageNodeWithDormantMultiline(
  value: unknown,
  inspection?: MiniAppInspection,
  options: UiValidationOptions = {},
): asserts value is PageNode {
  validatePageNodeWithDormantFormHints(value, inspection, options);
}

function stripAndValidateFormHints(
  value: unknown,
  inspection: MiniAppInspection | undefined,
  options: UiValidationOptions,
): unknown {
  return visit(value, "page", supportsDormantSdk12(inspection, options));
}

function visit(value: unknown, path: string, supportsSdk12: boolean): unknown {
  if (Array.isArray(value)) {
    return value.map((entry, index) => visit(entry, `${path}[${index}]`, supportsSdk12));
  }
  if (!isPlainObject(value)) return value;

  const isTextInput = value.type === "text-input";
  const multilinePresent = Object.prototype.hasOwnProperty.call(value, "multiline");
  const minLinesPresent = Object.prototype.hasOwnProperty.call(value, "minLines");
  if (isTextInput && (multilinePresent || minLinesPresent)) {
    if (!supportsSdk12) fail(path, "Multiline text inputs require SDK 1.2.");
    if (multilinePresent && typeof value.multiline !== "boolean") {
      fail(`${path}.multiline`, "Expected a boolean.");
    }
    if (minLinesPresent) {
      if (value.multiline !== true) {
        fail(`${path}.minLines`, "minLines requires multiline: true.");
      }
      if (
        typeof value.minLines !== "number" ||
        !Number.isInteger(value.minLines) ||
        value.minLines < 2 ||
        value.minLines > 8
      ) {
        fail(`${path}.minLines`, "Expected an integer from 2 to 8.");
      }
    }
  }

  const isNumberInput = value.type === "number-input";
  const stepPresent = Object.prototype.hasOwnProperty.call(value, "step");
  const decimalPlacesPresent = Object.prototype.hasOwnProperty.call(value, "decimalPlaces");
  if (isNumberInput && (stepPresent || decimalPlacesPresent)) {
    if (!supportsSdk12) fail(path, "Numeric input hints require SDK 1.2.");
    if (
      stepPresent &&
      (typeof value.step !== "number" || !Number.isFinite(value.step) || value.step <= 0)
    ) {
      fail(`${path}.step`, "Expected a finite number greater than zero.");
    }
    if (
      decimalPlacesPresent &&
      (typeof value.decimalPlaces !== "number" ||
        !Number.isInteger(value.decimalPlaces) ||
        value.decimalPlaces < 0 ||
        value.decimalPlaces > 6)
    ) {
      fail(`${path}.decimalPlaces`, "Expected an integer from 0 to 6.");
    }
  }

  const isMultiSelect = value.type === "multi-select";
  if (isMultiSelect) {
    if (!supportsSdk12) fail(path, "Multi-select inputs require SDK 1.2.");
    exactKeys(value, ["type", "setting", "label"], path);
  }

  const copy: PlainObject = {};
  for (const [key, entry] of Object.entries(value)) {
    if (isTextInput && (key === "multiline" || key === "minLines")) continue;
    if (isNumberInput && (key === "step" || key === "decimalPlaces")) continue;
    copy[key] = visit(entry, `${path}.${key}`, supportsSdk12);
  }
  if (isMultiSelect) copy.type = "select";
  return copy;
}

function legacyInspection(inspection: MiniAppInspection | undefined): MiniAppInspection | undefined {
  if (inspection === undefined) return undefined;
  return {
    ...inspection,
    settings: Object.fromEntries(
      Object.entries(inspection.settings).map(([name, definition]) => [
        name,
        legacySettingDefinition(definition),
      ]),
    ),
  };
}

function legacySettingDefinition(definition: SettingDefinition): SettingDefinition {
  if (definition.type !== "multi-select") return definition;
  return {
    type: "select",
    label: definition.label,
    ...(definition.description === undefined ? {} : { description: definition.description }),
    ...(definition.visibleWhen === undefined ? {} : { visibleWhen: definition.visibleWhen }),
    default: definition.options[0]?.value ?? "",
    options: definition.options,
  };
}

function supportsDormantSdk12(
  inspection: MiniAppInspection | undefined,
  options: UiValidationOptions,
): boolean {
  if (options.allowDormantSdk12 !== true) return false;
  return inspection === undefined || inspection.manifest.sdkVersion === "1.2";
}

function exactKeys(object: PlainObject, allowed: readonly string[], path: string): void {
  const allowedKeys = new Set(allowed);
  for (const key of Object.keys(object)) {
    if (!allowedKeys.has(key)) fail(`${path}.${key}`, "Unknown UI property.");
  }
}

function isPlainObject(value: unknown): value is PlainObject {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function fail(path: string, message: string): never {
  throw new Error(`VALIDATION_FAILED: ${path}: ${message}`);
}
