import { isSerializableValue, validateMiniAppDefinition } from "@pocket-tools/sdk-contract";

import type {
  MetricNode,
  MiniAppInspection,
  RuntimeEffect,
  RuntimeLogEntry,
  RuntimeOperation,
  RuntimeSuccess,
  SettingDefinition,
  TimerSnapshot,
} from "../model.ts";
import { assertNotificationId, parseNotificationRequestShape } from "./notification-validation.ts";
import { validateSdkPageNode } from "./sdk12-multiline-ui.ts";

const LOG_LEVELS = new Set(["log", "info", "warn", "error"]);
const IDENTIFIER_PATTERN = /^[a-z][A-Za-z0-9]*$/;

export class MiniAppRuntimeError extends Error {
  readonly code: string;
  readonly scriptStack: string | undefined;
  readonly logs: readonly RuntimeLogEntry[];
  readonly logsTruncated: boolean;

  constructor(
    code: string,
    message: string,
    options: {
      readonly scriptStack?: string;
      readonly logs?: readonly RuntimeLogEntry[];
      readonly logsTruncated?: boolean;
      readonly cause?: unknown;
    } = {},
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "MiniAppRuntimeError";
    this.code = code;
    this.scriptStack = options.scriptStack;
    this.logs = options.logs ?? [];
    this.logsTruncated = options.logsTruncated ?? false;
  }
}

export function parseRuntimeResponse(json: string): RuntimeSuccess {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (cause) {
    throw invalidNative("The native sandbox returned invalid JSON.", { cause });
  }

  if (!isRecord(parsed) || typeof parsed.ok !== "boolean") {
    throw invalidNative("The native sandbox returned an invalid response envelope.");
  }

  const logs = parseLogs(parsed.logs);
  if (typeof parsed.logsTruncated !== "boolean") {
    throw invalidNative("The native sandbox omitted its log truncation state.", { logs });
  }

  if (!parsed.ok) {
    if (
      !isRecord(parsed.error) ||
      typeof parsed.error.code !== "string" ||
      typeof parsed.error.message !== "string" ||
      (parsed.error.stack !== undefined && typeof parsed.error.stack !== "string")
    ) {
      throw invalidNative("The native sandbox returned an invalid error payload.", {
        logs,
        logsTruncated: parsed.logsTruncated,
      });
    }
    throw new MiniAppRuntimeError(parsed.error.code, parsed.error.message, {
      ...(parsed.error.stack === undefined ? {} : { scriptStack: parsed.error.stack }),
      logs,
      logsTruncated: parsed.logsTruncated,
    });
  }

  if (!isRecord(parsed.value)) {
    throw invalidNative("The native sandbox returned an invalid success payload.", {
      logs,
      logsTruncated: parsed.logsTruncated,
    });
  }

  const operations = parseOperations(parsed.value.operations);
  const effects = parseEffects(parsed.value.effects);
  const inspection =
    parsed.value.inspection === undefined ? undefined : parseInspection(parsed.value.inspection);
  if (parsed.value.page !== undefined) {
    try {
      validateSdkPageNode(parsed.value.page);
    } catch (cause) {
      throw new MiniAppRuntimeError(
        "INVALID_UI_TREE",
        cause instanceof Error ? cause.message : "The script returned invalid UI output.",
        { cause, logs, logsTruncated: parsed.logsTruncated },
      );
    }
  }

  return {
    ok: true,
    logs,
    logsTruncated: parsed.logsTruncated,
    value: {
      operations,
      ...(effects === undefined ? {} : { effects }),
      ...(inspection === undefined ? {} : { inspection }),
      ...(parsed.value.page === undefined ? {} : { page: parsed.value.page }),
    },
  } as RuntimeSuccess;
}

/** @deprecated SDK 1.2 is public; use parseRuntimeResponse. */
export const parseDormantSdk12RuntimeResponse = parseRuntimeResponse;

function parseInspection(value: unknown): MiniAppInspection {
  if (!isRecord(value)) throw invalidNative("The runtime inspection must be a plain object.");
  exactKeys(value, ["manifest", "settings", "collections", "screens", "actions"], "inspection");
  if (!isRecord(value.manifest) || !isRecord(value.settings) || !isRecord(value.collections)) {
    throw invalidNative("The runtime inspection contains invalid definitions.");
  }
  const screens = parseIdentifierList(value.screens, "inspection.screens");
  const actions = parseIdentifierList(value.actions, "inspection.actions");

  const dummyPage = { type: "page" as const, title: "Validation", children: [] };
  const definition = {
    manifest: value.manifest,
    settings: value.settings,
    collections: value.collections,
    screens: Object.fromEntries(screens.map((name) => [name, () => dummyPage])),
    actions: Object.fromEntries(actions.map((name) => [name, () => undefined])),
  } as unknown as Parameters<typeof validateMiniAppDefinition>[0];
  const issues = validateMiniAppDefinition(definition);
  if (issues.length > 0) {
    throw new MiniAppRuntimeError(
      "VALIDATION_FAILED",
      issues.map((issue) => `${issue.path}: ${issue.message}`).join("\n"),
    );
  }
  return {
    manifest: definition.manifest,
    settings: definition.settings ?? {},
    collections: definition.collections ?? {},
    screens,
    actions,
  } as MiniAppInspection;
}

function parseIdentifierList(value: unknown, path: string): readonly string[] {
  if (!Array.isArray(value)) throw invalidNative(`${path} must be an array.`);
  const names = value.map((entry, index) => {
    if (typeof entry !== "string" || !IDENTIFIER_PATTERN.test(entry)) {
      throw invalidNative(`${path}[${index}] must be a lower camelCase identifier.`);
    }
    return entry;
  });
  if (new Set(names).size !== names.length) throw invalidNative(`${path} contains duplicates.`);
  return names;
}

function parseOperations(value: unknown): readonly RuntimeOperation[] {
  if (!Array.isArray(value)) throw invalidNative("The runtime operation list is invalid.");
  return value.map((entry, index) => {
    const path = `operations[${index}]`;
    if (!isRecord(entry) || typeof entry.type !== "string") {
      throw invalidNative(`${path} must be a typed plain object.`);
    }
    if (entry.type === "insert") {
      exactKeys(entry, ["type", "collection", "record"], path);
      requireIdentifier(entry.collection, `${path}.collection`);
      if (!isRecord(entry.record) || !isSerializableValue(entry.record)) {
        throw invalidNative(`${path}.record must be a serializable plain object.`);
      }
      return entry as unknown as RuntimeOperation;
    }
    if (entry.type === "update") {
      exactKeys(entry, ["type", "collection", "id", "changes"], path);
      requireIdentifier(entry.collection, `${path}.collection`);
      requireString(entry.id, `${path}.id`);
      if (!isRecord(entry.changes) || !isSerializableValue(entry.changes)) {
        throw invalidNative(`${path}.changes must be a serializable plain object.`);
      }
      return entry as unknown as RuntimeOperation;
    }
    if (entry.type === "remove") {
      exactKeys(entry, ["type", "collection", "id"], path);
      requireIdentifier(entry.collection, `${path}.collection`);
      requireString(entry.id, `${path}.id`);
      return entry as unknown as RuntimeOperation;
    }
    if (entry.type === "setting-set") {
      exactKeys(entry, ["type", "setting", "value"], path);
      requireIdentifier(entry.setting, `${path}.setting`);
      if (!isSerializableValue(entry.value)) {
        throw invalidNative(`${path}.value must be serializable.`);
      }
      return entry as unknown as RuntimeOperation;
    }
    if (entry.type === "setting-reset") {
      exactKeys(entry, ["type", "setting"], path);
      requireIdentifier(entry.setting, `${path}.setting`);
      return entry as unknown as RuntimeOperation;
    }
    if (entry.type === "timer-start") {
      exactKeys(entry, ["type", "timerId", "startedAt"], path);
      requireIdentifier(entry.timerId, `${path}.timerId`);
      const startedAt = requireString(entry.startedAt, `${path}.startedAt`);
      if (!Number.isFinite(Date.parse(startedAt))) {
        throw invalidNative(`${path}.startedAt must be a date-time string.`);
      }
      return entry as unknown as RuntimeOperation;
    }
    if (entry.type === "timer-stop") {
      exactKeys(entry, ["type", "timerId"], path);
      requireIdentifier(entry.timerId, `${path}.timerId`);
      return entry as unknown as RuntimeOperation;
    }
    if (entry.type === "notification-schedule") {
      exactRequiredKeys(entry, ["type", "request"], path);
      try {
        return {
          type: "notification-schedule",
          request: parseNotificationRequestShape(entry.request, `${path}.request`),
        };
      } catch (cause) {
        throw invalidNative(errorMessage(cause));
      }
    }
    if (entry.type === "notification-cancel") {
      exactRequiredKeys(entry, ["type", "notificationId"], path);
      try {
        return {
          type: "notification-cancel",
          notificationId: assertNotificationId(entry.notificationId, `${path}.notificationId`),
        };
      } catch (cause) {
        throw invalidNative(errorMessage(cause));
      }
    }
    if (entry.type === "notification-cancel-all") {
      exactRequiredKeys(entry, ["type"], path);
      return { type: "notification-cancel-all" };
    }
    throw invalidNative(`${path}.type is unsupported.`);
  });
}

function parseEffects(value: unknown): readonly RuntimeEffect[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw invalidNative("The runtime effect list is invalid.");
  if (value.length > 2) {
    throw invalidNative("An action may return at most one output effect and one feedback effect.");
  }

  let feedbackSeen = false;
  let outputSeen = false;
  return value.map((entry, index) => {
    const path = `effects[${index}]`;
    if (!isRecord(entry) || typeof entry.type !== "string") {
      throw invalidNative(`${path} must be a typed plain object.`);
    }

    if (entry.type === "feedback") {
      if (feedbackSeen) throw invalidNative("An action may return at most one feedback effect.");
      feedbackSeen = true;
      exactKeys(entry, ["type", "message"], path);
      boundedText(entry.message, `${path}.message`, 1, 160);
      return entry as unknown as RuntimeEffect;
    }

    if (entry.type === "copy") {
      if (outputSeen) throw invalidNative("An action may return at most one output effect.");
      outputSeen = true;
      exactKeys(entry, ["type", "text"], path);
      boundedText(entry.text, `${path}.text`, 1, 10_000);
      return entry as unknown as RuntimeEffect;
    }

    if (entry.type === "share") {
      if (outputSeen) throw invalidNative("An action may return at most one output effect.");
      outputSeen = true;
      exactKeys(entry, ["type", "text", "title"], path);
      boundedText(entry.text, `${path}.text`, 1, 10_000);
      if (entry.title !== undefined) boundedText(entry.title, `${path}.title`, 1, 120);
      return entry as unknown as RuntimeEffect;
    }

    throw invalidNative(`${path}.type is unsupported.`);
  });
}

function parseLogs(value: unknown): readonly RuntimeLogEntry[] {
  if (!Array.isArray(value)) {
    throw invalidNative("The native sandbox returned an invalid log payload.");
  }
  return value.map((entry) => {
    if (
      !isRecord(entry) ||
      typeof entry.level !== "string" ||
      !LOG_LEVELS.has(entry.level) ||
      typeof entry.message !== "string"
    ) {
      throw invalidNative("The native sandbox returned an invalid log entry.");
    }
    return entry as unknown as RuntimeLogEntry;
  });
}

function exactKeys(
  object: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
): void {
  const allowedKeys = new Set(allowed);
  for (const key of Object.keys(object)) {
    if (!allowedKeys.has(key)) throw invalidNative(`${path}.${key} is not supported.`);
  }
}

function exactRequiredKeys(
  object: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
): void {
  exactKeys(object, allowed, path);
  for (const key of allowed) {
    if (!Object.prototype.hasOwnProperty.call(object, key)) {
      throw invalidNative(`${path}.${key} is required.`);
    }
  }
}

function requireIdentifier(value: unknown, path: string): string {
  const text = requireString(value, path);
  if (!IDENTIFIER_PATTERN.test(text)) throw invalidNative(`${path} must be lower camelCase.`);
  return text;
}

function requireString(value: unknown, path: string): string {
  if (typeof value !== "string" || value.length === 0) throw invalidNative(`${path} must be text.`);
  return value;
}

function boundedText(value: unknown, path: string, minimum: number, maximum: number): string {
  if (typeof value !== "string") throw invalidNative(`${path} must be text.`);
  const length = Array.from(value).length;
  if (length < minimum || length > maximum) {
    throw invalidNative(`${path} must contain ${minimum} to ${maximum} characters.`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function errorMessage(caught: unknown): string {
  return caught instanceof Error ? caught.message : String(caught);
}

function invalidNative(
  message: string,
  options: ConstructorParameters<typeof MiniAppRuntimeError>[2] = {},
): MiniAppRuntimeError {
  return new MiniAppRuntimeError("INVALID_NATIVE_RESPONSE", message, options);
}

export function timerElapsedSeconds(
  timer: TimerSnapshot | undefined,
  nowMilliseconds: number,
): number {
  if (timer === undefined) return 0;
  const startedAt = Date.parse(timer.startedAt);
  if (!Number.isFinite(startedAt)) return Math.max(0, timer.elapsedSeconds);
  return Math.max(timer.elapsedSeconds, (nowMilliseconds - startedAt) / 1_000);
}

export function metricValue(
  node: MetricNode,
  timers: Readonly<Record<string, TimerSnapshot>>,
  nowMilliseconds: number,
): string | number {
  if (node.liveTimer === undefined) return node.value;
  const elapsedSeconds = timerElapsedSeconds(timers[node.liveTimer.timerId], nowMilliseconds);
  return Number(node.value) + (elapsedSeconds / 3_600) * node.liveTimer.ratePerHour;
}

export function settingIsVisible(
  definition: SettingDefinition,
  values: Readonly<Record<string, unknown>>,
): boolean {
  const rule = definition.visibleWhen;
  return rule === undefined || values[rule.setting] === rule.equals;
}
