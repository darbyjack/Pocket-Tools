import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  AuthoringValidationError,
  inspectMiniAppSource,
  validateMiniAppSource,
} from "./inspection.ts";
import { AuthoringRuntimeError } from "./quickjs.ts";

type Command = "inspect" | "validate";

interface Arguments {
  readonly command: Command;
  readonly file: string;
  readonly json: boolean;
}

async function main(): Promise<void> {
  const rawArguments = process.argv.slice(2);
  let argumentsValue: Arguments;
  try {
    argumentsValue = parseArguments(rawArguments);
  } catch (caught) {
    writeFailure(
      "USAGE_ERROR",
      caught instanceof Error ? caught.message : String(caught),
      rawArguments.includes("--json"),
    );
    process.exitCode = 2;
    return;
  }

  const file = resolve(argumentsValue.file);
  let source: string;
  try {
    source = await readFile(file, "utf8");
  } catch (caught) {
    writeFailure(
      "SOURCE_READ_FAILED",
      caught instanceof Error ? caught.message : `Unable to read ${file}.`,
      argumentsValue.json,
    );
    process.exitCode = 1;
    return;
  }

  try {
    if (argumentsValue.command === "validate") {
      await validateMiniAppSource(source);
      if (argumentsValue.json) {
        process.stdout.write(`${JSON.stringify({ ok: true, command: "validate", file })}\n`);
      } else {
        process.stdout.write(`Valid Pocket Tools SDK v1 mini-app: ${file}\n`);
      }
      return;
    }

    const inspection = await inspectMiniAppSource(source);
    if (argumentsValue.json) {
      process.stdout.write(
        `${JSON.stringify({ ok: true, command: "inspect", file, inspection }, null, 2)}\n`,
      );
      return;
    }

    process.stdout.write(
      [
        `Pocket Tools SDK v1 mini-app: ${inspection.manifest.name}`,
        `ID: ${inspection.manifest.id}`,
        `Settings: ${names(inspection.settings)}`,
        `Collections: ${names(inspection.collections)}`,
        `Screens: ${inspection.screens.join(", ")}`,
        `Actions: ${inspection.actions.length === 0 ? "none" : inspection.actions.join(", ")}`,
      ].join("\n") + "\n",
    );
  } catch (caught) {
    if (caught instanceof AuthoringValidationError) {
      writeFailure(caught.code, caught.message, argumentsValue.json, caught.issues);
    } else if (caught instanceof AuthoringRuntimeError) {
      writeFailure(caught.code, caught.message, argumentsValue.json, undefined, caught.scriptStack);
    } else {
      writeFailure(
        "AUTHORING_TOOL_FAILED",
        caught instanceof Error ? caught.message : String(caught),
        argumentsValue.json,
      );
    }
    process.exitCode = 1;
  }
}

function parseArguments(values: readonly string[]): Arguments {
  const json = values.includes("--json");
  const positional = values.filter((value) => value !== "--json");
  const [command, file, ...extra] = positional;
  if (command !== "validate" && command !== "inspect") {
    throw new Error("Usage: pnpm mini-app <validate|inspect> <file> [--json]");
  }
  if (file === undefined || extra.length > 0) {
    throw new Error("Usage: pnpm mini-app <validate|inspect> <file> [--json]");
  }
  return { command, file, json };
}

function names(value: Readonly<Record<string, unknown>>): string {
  const entries = Object.keys(value);
  return entries.length === 0 ? "none" : entries.join(", ");
}

function writeFailure(
  code: string,
  message: string,
  json: boolean,
  issues?: readonly { readonly path: string; readonly message: string }[],
  scriptStack?: string,
): void {
  if (json) {
    process.stderr.write(
      `${JSON.stringify(
        {
          ok: false,
          error: {
            code,
            message,
            ...(issues === undefined ? {} : { issues }),
            ...(scriptStack === undefined ? {} : { stack: scriptStack }),
          },
        },
        null,
        2,
      )}\n`,
    );
    return;
  }

  process.stderr.write(`${code}: ${message}\n`);
}

await main();
