import type { MiniAppInspection, PageNode } from "../model.ts";
import { validatePageNode, type UiValidationOptions } from "./ui-validation.ts";

type PlainObject = Record<string, unknown>;

export function validatePageNodeWithDormantMultiline(
  value: unknown,
  inspection?: MiniAppInspection,
  options: UiValidationOptions = {},
): asserts value is PageNode {
  const legacyCompatible = stripAndValidateMultiline(value, inspection, options);
  validatePageNode(legacyCompatible, inspection, options);
}

function stripAndValidateMultiline(
  value: unknown,
  inspection: MiniAppInspection | undefined,
  options: UiValidationOptions,
): unknown {
  return visit(value, "page", supportsDormantMultiline(inspection, options));
}

function visit(value: unknown, path: string, supportsMultiline: boolean): unknown {
  if (Array.isArray(value)) {
    return value.map((entry, index) => visit(entry, `${path}[${index}]`, supportsMultiline));
  }
  if (!isPlainObject(value)) return value;

  const multilinePresent = Object.prototype.hasOwnProperty.call(value, "multiline");
  const minLinesPresent = Object.prototype.hasOwnProperty.call(value, "minLines");
  if (value.type === "text-input" && (multilinePresent || minLinesPresent)) {
    if (!supportsMultiline) fail(path, "Multiline text inputs require SDK 1.2.");
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

  const copy: PlainObject = {};
  for (const [key, entry] of Object.entries(value)) {
    if (value.type === "text-input" && (key === "multiline" || key === "minLines")) continue;
    copy[key] = visit(entry, `${path}.${key}`, supportsMultiline);
  }
  return copy;
}

function supportsDormantMultiline(
  inspection: MiniAppInspection | undefined,
  options: UiValidationOptions,
): boolean {
  if (options.allowDormantSdk12 !== true) return false;
  return inspection === undefined || inspection.manifest.sdkVersion === "1.2";
}

function isPlainObject(value: unknown): value is PlainObject {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function fail(path: string, message: string): never {
  throw new Error(`VALIDATION_FAILED: ${path}: ${message}`);
}
