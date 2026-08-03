import RELEASE_SYNC from "@jitl/quickjs-ng-wasmfile-release-sync";
import {
  newQuickJSWASMModuleFromVariant,
  shouldInterruptAfterDeadline,
} from "quickjs-emscripten-core";

import { findImportViolation } from "./imports.ts";
import {
  readEmbeddedRuntimeSources,
  RuntimeSourceError,
} from "./runtime-sources.ts";

const SDK_MODULE = "@pocket-tools/sdk";
const MINI_APP_MODULE = "pocket-mini-app.mjs";
const MEMORY_LIMIT_BYTES = 32 * 1024 * 1024;
const STACK_LIMIT_BYTES = 512 * 1024;
const TIMEOUT_MILLISECONDS = 1_000;

const quickJsModule = newQuickJSWASMModuleFromVariant(RELEASE_SYNC);

export class AuthoringRuntimeError extends Error {
  readonly code: string;
  readonly scriptStack: string | undefined;

  constructor(code: string, message: string, scriptStack?: string) {
    super(message);
    this.name = "AuthoringRuntimeError";
    this.code = code;
    this.scriptStack = scriptStack;
  }
}

export interface InspectionRequest {
  readonly mode: "inspect";
  readonly now: string;
  readonly settings: Readonly<Record<string, never>>;
  readonly records: Readonly<Record<string, never>>;
  readonly timers: Readonly<Record<string, never>>;
}

export async function executeInspection(source: string): Promise<unknown> {
  const violation = findImportViolation(source);
  if (violation !== null) {
    throw new AuthoringRuntimeError(
      "UNSUPPORTED_MODULE",
      `${violation.message} (${violation.line}:${violation.column})`,
    );
  }

  const request: InspectionRequest = {
    mode: "inspect",
    now: new Date(0).toISOString(),
    settings: {},
    records: {},
    timers: {},
  };
  return executeEmbeddedRuntime(source, request);
}

async function executeEmbeddedRuntime(source: string, request: InspectionRequest): Promise<unknown> {
  const initialization = await Promise.all([
    readEmbeddedRuntimeSources(),
    quickJsModule,
  ]).catch((caught: unknown) => {
    if (caught instanceof RuntimeSourceError) {
      throw new AuthoringRuntimeError(caught.code, caught.message);
    }
    throw caught;
  });
  const [{ sdk, runner }, quickJs] = initialization;
  const runtime = quickJs.newRuntime();
  runtime.setMemoryLimit(MEMORY_LIMIT_BYTES);
  runtime.setMaxStackSize(STACK_LIMIT_BYTES);
  runtime.setInterruptHandler(
    shouldInterruptAfterDeadline(Date.now() + TIMEOUT_MILLISECONDS),
  );
  runtime.setModuleLoader((moduleName) => {
    if (moduleName === SDK_MODULE) return sdk;
    if (moduleName === MINI_APP_MODULE) return source;
    return unsupportedModuleSource(moduleName);
  });

  const context = runtime.newContext();
  try {
    context
      .unwrapResult(
        context.evalCode(
          "globalThis.console = Object.freeze({ log() {}, info() {}, warn() {}, error() {} });",
          "pocket-authoring-console.js",
        ),
      )
      .dispose();

    const entrySource = `
import definition from ${JSON.stringify(MINI_APP_MODULE)};
const run = ${runner};
export default run(definition, ${JSON.stringify(request)});
`;
    const evaluated = context.evalCode(entrySource, "pocket-authoring-entry.mjs", {
      type: "module",
    });
    const moduleExports = context.unwrapResult(evaluated);
    try {
      const dumped = context.dump(moduleExports) as Record<string, unknown>;
      if (
        dumped === null ||
        typeof dumped !== "object" ||
        !("default" in dumped)
      ) {
        throw new AuthoringRuntimeError(
          "ASYNC_NOT_SUPPORTED",
          "The mini-app must be synchronously inspectable and cannot use top-level await.",
        );
      }
      return dumped.default;
    } finally {
      moduleExports.dispose();
    }
  } catch (caught) {
    throw normalizeRuntimeError(caught);
  } finally {
    context.dispose();
    runtime.dispose();
  }
}

function unsupportedModuleSource(moduleName: string): string {
  return `
const error = new Error(${JSON.stringify(`Unsupported module: ${moduleName}`)});
error.code = "UNSUPPORTED_MODULE";
throw error;
`;
}

function normalizeRuntimeError(caught: unknown): AuthoringRuntimeError {
  if (caught instanceof AuthoringRuntimeError) return caught;

  if (isRecord(caught)) {
    const message = typeof caught.message === "string" ? caught.message : String(caught);
    const stack = typeof caught.stack === "string" ? caught.stack : undefined;
    const explicitCode = typeof caught.code === "string" ? caught.code : undefined;
    return new AuthoringRuntimeError(
      explicitCode ?? inferCode(message),
      message,
      stack,
    );
  }

  const message = caught instanceof Error ? caught.message : String(caught);
  return new AuthoringRuntimeError(inferCode(message), message);
}

function inferCode(message: string): string {
  const normalized = message.toLowerCase();
  if (normalized.includes("unsupported module")) return "UNSUPPORTED_MODULE";
  if (normalized.includes("interrupted")) return "RUNTIME_TIMEOUT";
  if (normalized.includes("out of memory")) return "RUNTIME_MEMORY_LIMIT";
  if (normalized.includes("stack overflow")) return "RUNTIME_STACK_LIMIT";
  return "RUNTIME_ERROR";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
