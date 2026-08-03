import type { MiniAppDefinition } from "./core.ts";
import { SDK_VERSION } from "./core.ts";

export interface ValidationIssue {
  readonly path: string;
  readonly message: string;
}

const identifierPattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const objectKeyPattern = /^[a-z][A-Za-z0-9]*$/;

function addIssue(issues: ValidationIssue[], path: string, message: string): void {
  issues.push({ path, message });
}

export function validateMiniAppDefinition(
  definition: MiniAppDefinition,
): readonly ValidationIssue[] {
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

  const screenEntries = Object.entries(definition.screens);
  if (screenEntries.length === 0) {
    addIssue(issues, "screens", "At least one screen is required.");
  }
  if (!("home" in definition.screens)) {
    addIssue(issues, "screens.home", "A home screen is required.");
  }
  validateObjectKeys(
    issues,
    "screens",
    screenEntries.map(([name]) => name),
  );

  validateObjectKeys(issues, "actions", Object.keys(definition.actions ?? {}));
  validateObjectKeys(issues, "settings", Object.keys(definition.settings ?? {}));
  validateObjectKeys(issues, "collections", Object.keys(definition.collections ?? {}));

  for (const [collectionName, collection] of Object.entries(
    definition.collections ?? {},
  )) {
    const fieldNames = Object.keys(collection.fields);
    if (fieldNames.length === 0) {
      addIssue(
        issues,
        `collections.${collectionName}.fields`,
        "At least one field is required.",
      );
    }
    validateObjectKeys(issues, `collections.${collectionName}.fields`, fieldNames);
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
