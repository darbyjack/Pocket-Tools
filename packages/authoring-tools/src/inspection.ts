import {
  validateMiniAppDefinition,
  type CollectionDefinition,
  type MiniAppDefinition,
  type MiniAppManifest,
  type SettingDefinition,
  type ValidationIssue,
} from "@pocket-tools/sdk-contract";

import { AuthoringRuntimeError, executeInspection } from "./quickjs.ts";
import { assertMiniAppTypeChecks } from "./typecheck.ts";

const IDENTIFIER_PATTERN = /^[a-z][A-Za-z0-9]*$/;

export interface AuthoringInspection {
  readonly manifest: MiniAppManifest;
  readonly settings: Readonly<Record<string, SettingDefinition>>;
  readonly collections: Readonly<Record<string, CollectionDefinition>>;
  readonly screens: readonly string[];
  readonly actions: readonly string[];
}

export class AuthoringValidationError extends Error {
  readonly code = "VALIDATION_FAILED" as const;
  readonly issues: readonly ValidationIssue[];

  constructor(issues: readonly ValidationIssue[]) {
    super(issues.map((issue) => `${issue.path}: ${issue.message}`).join("\n"));
    this.name = "AuthoringValidationError";
    this.issues = issues;
  }
}

export async function inspectMiniAppSource(
  source: string,
  fileName?: string,
): Promise<AuthoringInspection> {
  const response = await executeInspection(source);
  const envelope = requireRecord(response, "runtime response");
  if (envelope.ok !== true) {
    const failure = requireRecord(envelope.error, "runtime error");
    throw new AuthoringRuntimeError(
      typeof failure.code === "string" ? failure.code : "RUNTIME_ERROR",
      typeof failure.message === "string"
        ? failure.message
        : "The embedded runtime rejected the mini-app.",
      typeof failure.stack === "string" ? failure.stack : undefined,
    );
  }

  const value = requireRecord(envelope.value, "runtime value");
  const rawInspection = requireRecord(value.inspection, "inspection");
  exactKeys(
    rawInspection,
    ["manifest", "settings", "collections", "screens", "actions"],
    "inspection",
  );

  const manifest = requireRecord(rawInspection.manifest, "inspection.manifest");
  const settings = requireRecord(rawInspection.settings, "inspection.settings");
  const collections = requireRecord(rawInspection.collections, "inspection.collections");
  const screens = requireIdentifiers(rawInspection.screens, "inspection.screens");
  const actions = requireIdentifiers(rawInspection.actions, "inspection.actions");
  const dummyPage = { type: "page" as const, title: "Inspection", children: [] };
  const definition = {
    manifest,
    settings,
    collections,
    screens: Object.fromEntries(screens.map((name) => [name, () => dummyPage])),
    actions: Object.fromEntries(actions.map((name) => [name, () => undefined])),
  } as unknown as MiniAppDefinition;

  const issues = validateMiniAppDefinition(definition);
  if (issues.length > 0) throw new AuthoringValidationError(issues);
  assertMiniAppTypeChecks(source, fileName);

  return {
    manifest: definition.manifest,
    settings: definition.settings ?? {},
    collections: definition.collections ?? {},
    screens,
    actions,
  };
}

export async function validateMiniAppSource(source: string, fileName?: string): Promise<void> {
  await inspectMiniAppSource(source, fileName);
}

function requireIdentifiers(value: unknown, path: string): readonly string[] {
  if (!Array.isArray(value)) throw shapeError(path, "must be an array");
  const names = value.map((entry, index) => {
    if (typeof entry !== "string" || !IDENTIFIER_PATTERN.test(entry)) {
      throw shapeError(`${path}[${index}]`, "must be a lower camelCase identifier");
    }
    return entry;
  });
  if (new Set(names).size !== names.length) {
    throw shapeError(path, "must not contain duplicates");
  }
  return names;
}

function requireRecord(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw shapeError(path, "must be a plain object");
  }
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, allowed: readonly string[], path: string): void {
  const allowedKeys = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      throw shapeError(`${path}.${key}`, "is not supported");
    }
  }
}

function shapeError(path: string, message: string): AuthoringRuntimeError {
  return new AuthoringRuntimeError("INVALID_RUNTIME_RESPONSE", `${path}: ${message}.`);
}
