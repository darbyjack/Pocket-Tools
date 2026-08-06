import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  bindSignedInspectionProvenance,
  defaultUnsignedInspectionPath,
  loadUnsignedSigningProvenance,
} from "./android-release-provenance-tools.mjs";
import { stableJson } from "./release-contract.mjs";

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const underlyingScript = resolve(repositoryRoot, "scripts", "android-release.mjs");
const [command, ...rawArguments] = process.argv.slice(2);
const argumentsMap = parseArguments(rawArguments);

switch (command) {
  case "sign": {
    const head = assertCleanHead();
    const input = repositoryPath(requiredArgument(argumentsMap, "input"));
    const sourceInspection = repositoryPath(
      optionalArgument(argumentsMap, "source-inspection") ??
        `${requiredArgument(argumentsMap, "input")}.inspection.json`,
    );
    await loadUnsignedSigningProvenance({
      apkPath: input,
      inspectionPath: sourceInspection,
      expectedSourceCommit: head,
    });
    runUnderlying("sign", removeArguments(rawArguments, ["source-inspection"]));
    break;
  }
  case "inspect": {
    const head = assertCleanHead();
    const tag = requiredArgument(argumentsMap, "tag");
    const abi = requiredArgument(argumentsMap, "abi");
    const output = repositoryPath(requiredArgument(argumentsMap, "output"));
    const sourceInspection = optionalArgument(argumentsMap, "source-inspection")
      ? repositoryPath(optionalArgument(argumentsMap, "source-inspection"))
      : defaultUnsignedInspectionPath({ repositoryRoot, tag, abi });
    const sourceApk = sourceInspection.endsWith(".inspection.json")
      ? sourceInspection.slice(0, -".inspection.json".length)
      : `${sourceInspection}.apk`;
    const provenance = await loadUnsignedSigningProvenance({
      apkPath: sourceApk,
      inspectionPath: sourceInspection,
      expectedSourceCommit: head,
      expectedTag: tag,
      expectedAbi: abi,
    });
    const stdout = runUnderlying(
      "inspect",
      removeArguments(rawArguments, ["output", "source-inspection"]),
      { capture: true },
    );
    let inspection;
    try {
      inspection = JSON.parse(stdout);
    } catch (cause) {
      throw new Error("ANDROID_PROVENANCE_INVALID: unable to parse signed APK inspection output.", {
        cause,
      });
    }
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, stableJson(bindSignedInspectionProvenance(inspection, provenance)), {
      encoding: "utf8",
      flag: "wx",
    });
    console.log(`Wrote provenance-bound APK inspection to ${output}.`);
    break;
  }
  default:
    throw new Error("ANDROID_PROVENANCE_COMMAND_INVALID: use sign or inspect.");
}

function assertCleanHead() {
  const head = run("git", ["rev-parse", "HEAD"], { capture: true }).trim();
  const status = run("git", ["status", "--porcelain=v1", "--untracked-files=all"], {
    capture: true,
  }).trim();
  if (status.length !== 0) {
    throw new Error(
      "ANDROID_PROVENANCE_WORKTREE_DIRTY: commit or remove local changes before signing or inspection.",
    );
  }
  return head;
}

function runUnderlying(commandName, arguments_, options = {}) {
  return run(process.execPath, [underlyingScript, commandName, ...arguments_], options);
}

function run(executable, arguments_, { capture = false } = {}) {
  const result = spawnSync(executable, arguments_, {
    cwd: repositoryRoot,
    encoding: "utf8",
    shell: false,
    env: process.env,
    stdio: capture ? "pipe" : "inherit",
  });
  if (result.error || result.status !== 0) {
    const detail = capture ? [result.stderr, result.stdout].filter(Boolean).join("\n").trim() : "";
    throw new Error(
      `ANDROID_PROVENANCE_TOOL_FAILED: ${executable} ${arguments_.join(" ")} failed${detail ? `: ${detail}` : "."}`,
      { cause: result.error },
    );
  }
  return capture ? result.stdout : "";
}

function repositoryPath(path) {
  return resolve(repositoryRoot, path);
}

function parseArguments(values) {
  const result = new Map();
  for (let index = 0; index < values.length; index += 1) {
    const key = values[index];
    if (!key.startsWith("--") || key.length === 2) {
      throw new Error(
        `ANDROID_PROVENANCE_ARGUMENT_INVALID: expected --name, received ${JSON.stringify(key)}.`,
      );
    }
    const name = key.slice(2);
    const value = values[index + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`ANDROID_PROVENANCE_ARGUMENT_INVALID: --${name} requires a value.`);
    }
    if (result.has(name)) {
      throw new Error(
        `ANDROID_PROVENANCE_ARGUMENT_INVALID: --${name} was provided more than once.`,
      );
    }
    result.set(name, value);
    index += 1;
  }
  return result;
}

function removeArguments(values, names) {
  const blocked = new Set(names);
  const output = [];
  for (let index = 0; index < values.length; index += 2) {
    const name = values[index].slice(2);
    if (!blocked.has(name)) output.push(values[index], values[index + 1]);
  }
  return output;
}

function requiredArgument(map, name) {
  const value = map.get(name);
  if (!value) throw new Error(`ANDROID_PROVENANCE_ARGUMENT_INVALID: --${name} is required.`);
  return value;
}

function optionalArgument(map, name) {
  return map.get(name);
}
