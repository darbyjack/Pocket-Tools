import type { MiniAppDefinition } from "./core.ts";
import { SDK_VERSION } from "./core.ts";
import { PERMISSION_NAMES, SDK_V1_PERMISSION_NAMES } from "./permissions.ts";

export interface ValidationIssue {
  readonly path: string;
  readonly message: string;
}

const identifierPattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const objectKeyPattern = /^[a-z][A-Za-z0-9]*$/;

function addIssue(issues: ValidationIssue[], path: string, message: string): void {
  issues.push({ path, message });
}

export function validateMiniAppDefinition(definition: MiniAppDefinition): readonly ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { manifest } = definition;

  if (!identifierPattern.test(manifest.id)) {
    addIssue(
      issues,
      "manifest.id",
      "Must use lowercase kebab-case and begin with a letter.",
    );
  }

  if (manifest.name.trim().length === 0 || manifest.name.length > 80) {
    addIssue(issues, "manifest.name", "Must contain between 1 and 80 characters.");
  }

  if (manifest.sdkVersion !== SDK_VERSION) {
    addIssue(
      issues,
      "manifest.sdkVersion",
      `SDK version ${String(manifest.sdkVersion)} is not supported by this contract.`,
    );
  }

  if (!Number.isSafeInteger(manifest.version) || manifest.version < 1) {
    addIssue(issues, "manifest.version", "Must be a positive safe integer.");
  }

  const permissionNames = new Set<string>();
  for (const [index, permission] of (manifest.permissions ?? []).entries()) {
    const path = `manifest.permissions[${index}]`;

    if (!PERMISSION_NAMES.includes(permission.capability)) {
      addIssue(issues, `${path}.capability`, "Unknown capability.");
    }

    if (!(SDK_V1_PERMISSION_NAMES as readonly string[]).includes(permission.capability)) {
      addIssue(issues, `${path}.capability`, "Capability is reserved for a later SDK version.");
    }

    if (permissionNames.has(permission.capability)) {
      addIssue(issues, `${path}.capability`, "Capability is declared more than once.");
    }
    permissionNames.add(permission.capability);

    if (permission.reason.trim().length < 8) {
      addIssue(issues, `${path}.reason`, "Explain the user-visible need in at least 8 characters.");
    }

    if (permission.capability === "network") {
      if (permission.allowedHosts.length === 0) {
        addIssue(issues, `${path}.allowedHosts`, "Network access requires at least one host.");
      }
      for (const [hostIndex, host] of permission.allowedHosts.entries()) {
        if (host.includes("://") || host.includes("/") || host.trim().length === 0) {
          addIssue(
            issues,
            `${path}.allowedHosts[${hostIndex}]`,
            "Use a hostname only, without a scheme, path, or empty value.",
          );
        }
      }
    }
  }

  const screenEntries = Object.entries(definition.screens);
  if (screenEntries.length === 0) {
    addIssue(issues, "screens", "At least one screen is required.");
  }
  if (!("home" in definition.screens)) {
    addIssue(issues, "screens.home", "A home screen is required.");
  }
  validateObjectKeys(issues, "screens", screenEntries.map(([name]) => name));

  validateObjectKeys(issues, "actions", Object.keys(definition.actions ?? {}));
  validateObjectKeys(issues, "settings", Object.keys(definition.settings ?? {}));
  validateObjectKeys(issues, "collections", Object.keys(definition.collections ?? {}));

  for (const [collectionName, collection] of Object.entries(definition.collections ?? {})) {
    const fieldNames = Object.keys(collection.fields);
    if (fieldNames.length === 0) {
      addIssue(issues, `collections.${collectionName}.fields`, "At least one field is required.");
    }
    validateObjectKeys(issues, `collections.${collectionName}.fields`, fieldNames);

    for (const [index, collectionIndex] of (collection.indexes ?? []).entries()) {
      if (collectionIndex.fields.length === 0) {
        addIssue(
          issues,
          `collections.${collectionName}.indexes[${index}].fields`,
          "An index must contain at least one field.",
        );
      }
      for (const indexedField of collectionIndex.fields) {
        if (!(indexedField in collection.fields)) {
          addIssue(
            issues,
            `collections.${collectionName}.indexes[${index}]`,
            `Unknown indexed field: ${indexedField}.`,
          );
        }
      }
    }
  }

  for (const versionText of Object.keys(definition.migrations ?? {})) {
    const version = Number(versionText);
    if (!Number.isSafeInteger(version) || version < 2 || version > manifest.version) {
      addIssue(
        issues,
        `migrations.${versionText}`,
        "Migration keys must be integer target versions from 2 through manifest.version.",
      );
    }
  }

  const testNames = new Set<string>();
  for (const [index, test] of (definition.tests ?? []).entries()) {
    const name = test.name.trim();
    if (name.length === 0) {
      addIssue(issues, `tests[${index}].name`, "Test name cannot be empty.");
    }
    if (testNames.has(name)) {
      addIssue(issues, `tests[${index}].name`, "Test names must be unique.");
    }
    testNames.add(name);
  }

  return issues;
}

function validateObjectKeys(
  issues: ValidationIssue[],
  parentPath: string,
  keys: readonly string[],
): void {
  for (const key of keys) {
    if (!objectKeyPattern.test(key)) {
      addIssue(
        issues,
        `${parentPath}.${key}`,
        "Use lower camelCase identifiers that begin with a letter.",
      );
    }
  }
}

export function assertValidMiniAppDefinition(definition: MiniAppDefinition): void {
  const issues = validateMiniAppDefinition(definition);
  if (issues.length === 0) {
    return;
  }

  const details = issues.map((issue) => `${issue.path}: ${issue.message}`).join("\n");
  throw new Error(`Mini app definition is invalid:\n${details}`);
}
