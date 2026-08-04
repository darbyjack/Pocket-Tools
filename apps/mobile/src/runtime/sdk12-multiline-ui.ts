import type { MiniAppInspection, PageNode, SettingDefinition } from "../model.ts";
import { BADGE_TONES } from "./sdk12-badge.ts";
import { UI_ICON_NAMES } from "./sdk12-icons.ts";
import { PROGRESS_FORMATS } from "./sdk12-progress.ts";
import { validatePageNode } from "./ui-validation.ts";

type PlainObject = Record<string, unknown>;

const BADGE_TONE_SET = new Set<string>(BADGE_TONES);
const PROGRESS_FORMAT_SET = new Set<string>(PROGRESS_FORMATS);
const UI_ICON_NAME_SET = new Set<string>(UI_ICON_NAMES);

export function validateSdkPageNode(
  value: unknown,
  inspection?: MiniAppInspection,
): asserts value is PageNode {
  const legacyCompatible = stripAndValidateSdk12Extensions(value, inspection);
  validatePageNode(legacyCompatible, legacyInspection(inspection), { allowDormantSdk12: true });
}

export const validatePageNodeWithDormantFormHints = validateSdkPageNode;
export const validatePageNodeWithDormantMultiline = validateSdkPageNode;

function stripAndValidateSdk12Extensions(
  value: unknown,
  inspection: MiniAppInspection | undefined,
): unknown {
  return visit(value, "page", inspection === undefined || inspection.manifest.sdkVersion === "1.2");
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

  const isBadge = value.type === "badge";
  if (isBadge) {
    if (!supportsSdk12) fail(path, "Badge nodes require SDK 1.2.");
    exactKeys(value, ["type", "text", "tone"], path);
    if (typeof value.text !== "string") fail(`${path}.text`, "Expected text.");
    const textLength = Array.from(value.text as string).length;
    if (textLength < 1 || textLength > 80) {
      fail(`${path}.text`, "Expected 1 to 80 characters.");
    }
    if (
      value.tone !== undefined &&
      (typeof value.tone !== "string" || !BADGE_TONE_SET.has(value.tone))
    ) {
      fail(`${path}.tone`, "Expected neutral, info, success, warning, or danger.");
    }
  }

  const isProgress = value.type === "progress";
  if (isProgress) {
    if (!supportsSdk12) fail(path, "Progress nodes require SDK 1.2.");
    exactKeys(value, ["type", "label", "value", "min", "max", "format"], path);
    if (value.label !== undefined && typeof value.label !== "string") {
      fail(`${path}.label`, "Expected text.");
    }
    if (typeof value.value !== "number" || !Number.isFinite(value.value)) {
      fail(`${path}.value`, "Expected a finite number.");
    }
    if (value.min !== undefined && (typeof value.min !== "number" || !Number.isFinite(value.min))) {
      fail(`${path}.min`, "Expected a finite number.");
    }
    if (value.max !== undefined && (typeof value.max !== "number" || !Number.isFinite(value.max))) {
      fail(`${path}.max`, "Expected a finite number.");
    }
    const minimum = value.min ?? 0;
    const maximum = value.max ?? 100;
    if (typeof minimum === "number" && typeof maximum === "number" && maximum <= minimum) {
      fail(`${path}.max`, "Expected max to be greater than min.");
    }
    if (
      value.format !== undefined &&
      (typeof value.format !== "string" || !PROGRESS_FORMAT_SET.has(value.format))
    ) {
      fail(`${path}.format`, "Expected number or percent.");
    }
  }

  const isListItem = value.type === "list-item";
  const isActionControl =
    value.type === "button" ||
    (value.type === undefined &&
      typeof value.label === "string" &&
      typeof value.action === "string");
  const iconPresent = Object.prototype.hasOwnProperty.call(value, "icon");
  const leadingIconPresent = isListItem && Object.prototype.hasOwnProperty.call(value, "leadingIcon");

  if (isActionControl && iconPresent) {
    validateIcon(value.icon, `${path}.icon`, supportsSdk12);
  }
  if (leadingIconPresent) {
    validateIcon(value.leadingIcon, `${path}.leadingIcon`, supportsSdk12);
  }

  const copy: PlainObject = {};
  for (const [key, entry] of Object.entries(value)) {
    if (isTextInput && (key === "multiline" || key === "minLines")) continue;
    if (isNumberInput && (key === "step" || key === "decimalPlaces")) continue;
    if (isBadge && key === "tone") continue;
    if (isProgress && ["label", "value", "min", "max", "format"].includes(key)) continue;
    if (isActionControl && key === "icon") continue;
    if (isListItem && key === "leadingIcon") continue;
    copy[key] = visit(entry, `${path}.${key}`, supportsSdk12);
  }
  if (isMultiSelect) copy.type = "select";
  if (isBadge) copy.type = "text";
  if (isProgress) {
    copy.type = "text";
    copy.text = String(value.value);
  }
  return copy;
}

function validateIcon(value: unknown, path: string, supportsSdk12: boolean): void {
  if (!supportsSdk12) fail(path, "Fixed host icons require SDK 1.2.");
  if (typeof value !== "string" || !UI_ICON_NAME_SET.has(value)) {
    fail(
      path,
      "Expected add, edit, delete, check, calendar, clock, copy, share, search, settings, warning, info, money, list, or refresh.",
    );
  }
}

function legacyInspection(
  inspection: MiniAppInspection | undefined,
): MiniAppInspection | undefined {
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
