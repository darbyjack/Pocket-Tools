import { isSerializableValue } from "@pocket-tools/sdk-contract";

import type { MiniAppInspection, PageNode, SettingDefinition } from "../model.ts";

const MAXIMUM_UI_NODES = 512;
const MAXIMUM_UI_DEPTH = 16;
const MAXIMUM_LIST_ITEM_ACTIONS = 3;
const IDENTIFIER_PATTERN = /^[a-z][A-Za-z0-9]*$/;
const FORMATS = new Set(["plain", "money", "duration", "number"]);
const ACTION_INTENTS = new Set(["default", "destructive"]);
const ACTION_KEYS = ["label", "action", "input", "intent", "disabled", "confirmation"];

type PlainObject = Record<string, unknown>;
type DisplayFormat = "plain" | "money" | "duration" | "number";

export interface UiValidationOptions {
  readonly allowDormantSdk12?: boolean;
}

interface ValidationState {
  count: number;
  inspection: MiniAppInspection | undefined;
  options: UiValidationOptions;
}

export function validatePageNode(
  value: unknown,
  inspection?: MiniAppInspection,
  options: UiValidationOptions = {},
): asserts value is PageNode {
  const state: ValidationState = { count: 0, inspection, options };
  const page = visitNode(value, "page", 0, state, true);
  if (page.type !== "page") fail("page", "A screen must return one page node.");
}

function visitNode(
  value: unknown,
  path: string,
  depth: number,
  state: ValidationState,
  allowPage: boolean,
): PlainObject {
  if (depth > MAXIMUM_UI_DEPTH) fail(path, `The UI tree exceeds ${MAXIMUM_UI_DEPTH} levels.`);
  state.count += 1;
  if (state.count > MAXIMUM_UI_NODES) fail(path, `The UI tree exceeds ${MAXIMUM_UI_NODES} nodes.`);

  const node = requireObject(value, path);
  const type = requireString(node.type, `${path}.type`, 1, 40);

  if (type === "page") {
    if (!allowPage) fail(path, "Page nodes cannot be nested.");
    exactKeys(node, ["type", "title", "children"], path);
    requireString(node.title, `${path}.title`, 1, 120);
    visitChildren(node.children, `${path}.children`, depth, state);
    return node;
  }

  switch (type) {
    case "section":
      exactKeys(node, ["type", "title", "children"], path);
      optionalString(node.title, `${path}.title`, 1, 120);
      visitChildren(node.children, `${path}.children`, depth, state);
      return node;
    case "row":
    case "column":
      exactKeys(node, ["type", "children"], path);
      visitChildren(node.children, `${path}.children`, depth, state);
      return node;
    case "heading":
      exactKeys(node, ["type", "text", "level"], path);
      requireString(node.text, `${path}.text`, 1, 500);
      if (node.level !== undefined && node.level !== 1 && node.level !== 2 && node.level !== 3) {
        fail(`${path}.level`, "Expected heading level 1, 2, or 3.");
      }
      return node;
    case "text":
      exactKeys(node, ["type", "text"], path);
      requireString(node.text, `${path}.text`, 0, 5_000);
      return node;
    case "metric": {
      exactKeys(node, ["type", "label", "value", "format", "liveTimer"], path);
      requireString(node.label, `${path}.label`, 1, 120);
      const format = readFormat(node.format, `${path}.format`);
      requireFormattedValue(node.value, format, `${path}.value`);
      if (node.liveTimer !== undefined) {
        const liveTimer = requireObject(node.liveTimer, `${path}.liveTimer`);
        exactKeys(liveTimer, ["timerId", "ratePerHour"], `${path}.liveTimer`);
        requireIdentifier(liveTimer.timerId, `${path}.liveTimer.timerId`);
        requireFiniteNumber(liveTimer.ratePerHour, `${path}.liveTimer.ratePerHour`);
      }
      return node;
    }
    case "timer":
      exactKeys(node, ["type", "timerId", "emptyValue"], path);
      requireIdentifier(node.timerId, `${path}.timerId`);
      optionalString(node.emptyValue, `${path}.emptyValue`, 0, 120);
      return node;
    case "text-input":
      exactKeys(node, ["type", "setting", "label", "placeholder"], path);
      validateSettingBinding(node, path, state, ["text"]);
      optionalString(node.placeholder, `${path}.placeholder`, 0, 500);
      return node;
    case "number-input":
      exactKeys(node, ["type", "setting", "label"], path);
      validateSettingBinding(node, path, state, ["number", "money"]);
      return node;
    case "toggle":
      exactKeys(node, ["type", "setting", "label"], path);
      validateSettingBinding(node, path, state, ["boolean"]);
      return node;
    case "select":
      exactKeys(node, ["type", "setting", "label"], path);
      validateSettingBinding(node, path, state, ["select"]);
      return node;
    case "date-input":
      if (!supportsSdk12(state)) fail(path, "Date inputs require SDK 1.2.");
      exactKeys(node, ["type", "setting", "label"], path);
      validateSettingBinding(node, path, state, ["date"]);
      return node;
    case "datetime-input":
      if (!supportsSdk12(state)) fail(path, "Date-time inputs require SDK 1.2.");
      exactKeys(node, ["type", "setting", "label"], path);
      validateSettingBinding(node, path, state, ["datetime"]);
      return node;
    case "button":
      exactKeys(node, ["type", ...ACTION_KEYS], path);
      validateActionControl(node, path, state);
      if (
        !supportsSdk11(state) &&
        (node.intent !== undefined ||
          node.disabled !== undefined ||
          node.confirmation !== undefined)
      ) {
        fail(path, "Action intent, disabled state, and confirmation require SDK 1.1.");
      }
      return node;
    case "navigation": {
      exactKeys(node, ["type", "label", "screen", "input"], path);
      requireString(node.label, `${path}.label`, 1, 120);
      const screen = requireIdentifier(node.screen, `${path}.screen`);
      validateInteractionInput(node.input, `${path}.input`);
      if (state.inspection !== undefined && !state.inspection.screens.includes(screen)) {
        fail(`${path}.screen`, `Unknown declared screen: ${screen}.`);
      }
      return node;
    }
    case "empty-state":
      exactKeys(node, ["type", "title", "description"], path);
      requireString(node.title, `${path}.title`, 1, 120);
      optionalString(node.description, `${path}.description`, 0, 500);
      return node;
    case "list-item": {
      exactKeys(node, ["type", "title", "subtitle", "trailing", "primaryAction", "actions"], path);
      requireString(node.title, `${path}.title`, 1, 500);
      optionalString(node.subtitle, `${path}.subtitle`, 0, 500);
      optionalString(node.trailing, `${path}.trailing`, 0, 120);
      if (node.primaryAction !== undefined) {
        if (!supportsSdk12(state)) {
          fail(`${path}.primaryAction`, "List-item primary actions require SDK 1.2.");
        }
        const primaryPath = `${path}.primaryAction`;
        const primaryAction = requireObject(node.primaryAction, primaryPath);
        exactKeys(primaryAction, ACTION_KEYS, primaryPath);
        validateActionControl(primaryAction, primaryPath, state);
        if (primaryAction.intent === "destructive" && primaryAction.confirmation === undefined) {
          fail(primaryPath, "Destructive list-item primary actions require confirmation.");
        }
      }
      if (node.actions !== undefined) {
        if (!supportsSdk11(state)) fail(`${path}.actions`, "List-item actions require SDK 1.1.");
        const actions = requireArray(node.actions, `${path}.actions`);
        if (actions.length === 0 || actions.length > MAXIMUM_LIST_ITEM_ACTIONS) {
          fail(
            `${path}.actions`,
            `List items may contain between 1 and ${MAXIMUM_LIST_ITEM_ACTIONS} actions.`,
          );
        }
        for (const [index, actionValue] of actions.entries()) {
          const actionPath = `${path}.actions[${index}]`;
          const action = requireObject(actionValue, actionPath);
          exactKeys(action, ACTION_KEYS, actionPath);
          validateActionControl(action, actionPath, state);
        }
      }
      return node;
    }
    case "list": {
      exactKeys(node, ["type", "title", "items", "emptyState"], path);
      optionalString(node.title, `${path}.title`, 1, 120);
      const items = requireArray(node.items, `${path}.items`);
      for (const [index, item] of items.entries()) {
        const validated = visitNode(item, `${path}.items[${index}]`, depth + 1, state, false);
        if (validated.type !== "list-item") {
          fail(`${path}.items[${index}]`, "Lists may contain list-item nodes only.");
        }
      }
      if (node.emptyState !== undefined) {
        const emptyState = visitNode(
          node.emptyState,
          `${path}.emptyState`,
          depth + 1,
          state,
          false,
        );
        if (emptyState.type !== "empty-state") {
          fail(`${path}.emptyState`, "A list emptyState must be an empty-state node.");
        }
      }
      return node;
    }
    case "summary": {
      exactKeys(node, ["type", "title", "values"], path);
      requireString(node.title, `${path}.title`, 1, 120);
      const values = requireArray(node.values, `${path}.values`);
      if (values.length > 100) {
        fail(`${path}.values`, "A summary cannot contain more than 100 values.");
      }
      for (const [index, entryValue] of values.entries()) {
        const entryPath = `${path}.values[${index}]`;
        const entry = requireObject(entryValue, entryPath);
        exactKeys(entry, ["label", "value", "format"], entryPath);
        requireString(entry.label, `${entryPath}.label`, 1, 120);
        const format = readFormat(entry.format, `${entryPath}.format`);
        requireFormattedValue(entry.value, format, `${entryPath}.value`);
      }
      return node;
    }
    default:
      fail(`${path}.type`, `Unsupported UI node type: ${type}`);
  }
}

function validateActionControl(action: PlainObject, path: string, state: ValidationState): void {
  requireString(action.label, `${path}.label`, 1, 120);
  const actionName = requireIdentifier(action.action, `${path}.action`);
  validateInteractionInput(action.input, `${path}.input`);
  if (state.inspection !== undefined && !state.inspection.actions.includes(actionName)) {
    fail(`${path}.action`, `Unknown declared action: ${actionName}.`);
  }
  if (
    action.intent !== undefined &&
    (typeof action.intent !== "string" || !ACTION_INTENTS.has(action.intent))
  ) {
    fail(`${path}.intent`, "Expected default or destructive action intent.");
  }
  if (action.disabled !== undefined && typeof action.disabled !== "boolean") {
    fail(`${path}.disabled`, "Expected a boolean disabled state.");
  }
  if (action.confirmation !== undefined) {
    const confirmationPath = `${path}.confirmation`;
    const confirmation = requireObject(action.confirmation, confirmationPath);
    exactKeys(confirmation, ["title", "message", "confirmLabel", "cancelLabel"], confirmationPath);
    requireString(confirmation.title, `${confirmationPath}.title`, 1, 120);
    optionalString(confirmation.message, `${confirmationPath}.message`, 0, 500);
    optionalString(confirmation.confirmLabel, `${confirmationPath}.confirmLabel`, 1, 80);
    optionalString(confirmation.cancelLabel, `${confirmationPath}.cancelLabel`, 1, 80);
  }
}

function supportsSdk11(state: ValidationState): boolean {
  return (
    state.inspection === undefined ||
    state.inspection.manifest.sdkVersion === "1.1" ||
    state.inspection.manifest.sdkVersion === "1.2"
  );
}

function supportsSdk12(state: ValidationState): boolean {
  if (state.options.allowDormantSdk12 !== true) return false;
  return state.inspection === undefined || state.inspection.manifest.sdkVersion === "1.2";
}

function validateSettingBinding(
  node: PlainObject,
  path: string,
  state: ValidationState,
  allowedTypes: readonly SettingDefinition["type"][],
): void {
  const settingName = requireIdentifier(node.setting, `${path}.setting`);
  optionalString(node.label, `${path}.label`, 1, 120);
  if (state.inspection === undefined) return;
  const definition = state.inspection.settings[settingName];
  if (definition === undefined) {
    fail(`${path}.setting`, `Unknown declared setting: ${settingName}.`);
  }
  if (!allowedTypes.includes(definition.type)) {
    fail(`${path}.setting`, `Setting ${settingName} has incompatible type ${definition.type}.`);
  }
}

function validateInteractionInput(value: unknown, path: string): void {
  if (value !== undefined && !isSerializableValue(value)) {
    fail(path, "Interaction input must be a finite serializable value.");
  }
}

function visitChildren(value: unknown, path: string, depth: number, state: ValidationState): void {
  const children = requireArray(value, path);
  for (const [index, child] of children.entries()) {
    visitNode(child, `${path}[${index}]`, depth + 1, state, false);
  }
}

function requireObject(value: unknown, path: string): PlainObject {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail(path, "Expected a plain object.");
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    fail(path, "Expected a plain object.");
  }
  return value as PlainObject;
}

function requireArray(value: unknown, path: string): readonly unknown[] {
  if (!Array.isArray(value)) fail(path, "Expected an array.");
  return value;
}

function exactKeys(object: PlainObject, allowed: readonly string[], path: string): void {
  const allowedKeys = new Set(allowed);
  for (const key of Object.keys(object)) {
    if (!allowedKeys.has(key)) fail(`${path}.${key}`, "Unknown UI property.");
  }
}

function requireString(
  value: unknown,
  path: string,
  minimumLength: number,
  maximumLength: number,
): string {
  if (typeof value !== "string" || value.length < minimumLength || value.length > maximumLength) {
    fail(path, `Expected a string from ${minimumLength} to ${maximumLength} characters.`);
  }
  return value;
}

function optionalString(
  value: unknown,
  path: string,
  minimumLength: number,
  maximumLength: number,
): void {
  if (value !== undefined) requireString(value, path, minimumLength, maximumLength);
}

function requireIdentifier(value: unknown, path: string): string {
  const identifier = requireString(value, path, 1, 80);
  if (!IDENTIFIER_PATTERN.test(identifier)) fail(path, "Expected a lower camelCase identifier.");
  return identifier;
}

function requireFiniteNumber(value: unknown, path: string): void {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    fail(path, "Expected a finite number.");
  }
}

function requireDisplayValue(value: unknown, path: string): void {
  if (typeof value === "number") {
    requireFiniteNumber(value, path);
    return;
  }
  requireString(value, path, 0, 2_000);
}

function requireFormattedValue(
  value: unknown,
  format: DisplayFormat | undefined,
  path: string,
): void {
  if (format === "money" || format === "duration" || format === "number") {
    requireFiniteNumber(value, path);
    return;
  }
  requireDisplayValue(value, path);
}

function readFormat(value: unknown, path: string): DisplayFormat | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !FORMATS.has(value)) {
    fail(path, "Unsupported display format.");
  }
  return value as DisplayFormat;
}

function fail(path: string, message: string): never {
  throw new Error(`INVALID_UI_TREE: ${path}: ${message}`);
}
