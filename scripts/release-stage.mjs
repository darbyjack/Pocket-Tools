import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { validateStagingInspectionProvenance } from "./android-release-provenance-tools.mjs";
import { stableJson, validateReleaseIdentity } from "./release-contract.mjs";
import { stageReleaseArtifacts } from "./release-staging-tools.mjs";

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const [command, ...rawArguments] = process.argv.slice(2);
const argumentsMap = parseArguments(rawArguments);

switch (command) {
  case "stage": {
    const identity = await loadAndValidateIdentity(requiredArgument(argumentsMap, "tag"));
    const rootPackage = await readJson("package.json");
    const mobilePackage = await readJson("apps/mobile/package.json");
    const inputDirectory = repositoryPath(requiredArgument(argumentsMap, "input"));
    await validateStagingInspectionProvenance({ identity, inputDirectory });
    const result = await stageReleaseArtifacts({
      identity,
      inputDirectory,
      outputDirectory: repositoryPath(requiredArgument(argumentsMap, "output")),
      publicationDirectory: repositoryPath(requiredArgument(argumentsMap, "publication")),
      spdxPath: repositoryPath("licenses/pocket-tools.spdx.json"),
      noticesPath: repositoryPath("THIRD_PARTY_NOTICES.md"),
      canonicalChecklistPath: repositoryPath("docs/RELEASE_ACCEPTANCE_CHECKLIST.md"),
      toolchain: {
        node: {
          actual: process.version,
          required: rootPackage.engines?.node,
        },
        packageManager: rootPackage.packageManager,
        expo: mobilePackage.dependencies?.expo,
        reactNative: mobilePackage.dependencies?.["react-native"],
      },
    });
    process.stdout.write(stableJson(result));
    break;
  }
  default:
    throw new Error("RELEASE_STAGE_COMMAND_INVALID: use stage.");
}

async function loadAndValidateIdentity(tag) {
  const rootPackage = await readJson("package.json");
  const mobilePackage = await readJson("apps/mobile/package.json");
  const appConfig = await readJson("apps/mobile/app.json");
  const sourceCommit = runGit(["rev-parse", "HEAD"]);
  const status = runGit(["status", "--porcelain=v1", "--untracked-files=all"]);
  if (status.length !== 0) {
    throw new Error("RELEASE_WORKTREE_DIRTY: commit or remove local changes before staging.");
  }
  return validateReleaseIdentity({
    tag,
    sourceCommit,
    rootVersion: rootPackage.version,
    mobileVersion: mobilePackage.version,
    expoVersion: appConfig.expo?.version,
    versionCode: appConfig.expo?.android?.versionCode,
    packageName: appConfig.expo?.android?.package,
  });
}

async function readJson(path) {
  try {
    return JSON.parse(await readFile(repositoryPath(path), "utf8"));
  } catch (cause) {
    throw new Error(`RELEASE_STAGE_INPUT_INVALID: unable to read ${path}.`, { cause });
  }
}

function runGit(args) {
  const result = spawnSync("git", args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    shell: false,
  });
  if (result.error || result.status !== 0) {
    throw new Error(`RELEASE_STAGE_GIT_FAILED: git ${args.join(" ")} failed.`, {
      cause: result.error ?? new Error(result.stderr.trim()),
    });
  }
  return result.stdout.trim();
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
        `RELEASE_STAGE_ARGUMENT_INVALID: expected --name, received ${JSON.stringify(key)}.`,
      );
    }
    const name = key.slice(2);
    const value = values[index + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`RELEASE_STAGE_ARGUMENT_INVALID: --${name} requires a value.`);
    }
    if (result.has(name)) {
      throw new Error(`RELEASE_STAGE_ARGUMENT_INVALID: --${name} was provided more than once.`);
    }
    result.set(name, value);
    index += 1;
  }
  return result;
}

function requiredArgument(argumentsMap, name) {
  const value = argumentsMap.get(name);
  if (!value) throw new Error(`RELEASE_STAGE_ARGUMENT_INVALID: --${name} is required.`);
  return value;
}
