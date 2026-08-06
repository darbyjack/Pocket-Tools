import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildSha256Sums,
  stableJson,
  validateReleaseIdentity,
  verifyReleaseDirectory,
} from "./release-contract.mjs";

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const [command, ...rawArguments] = process.argv.slice(2);
const argumentsMap = parseArguments(rawArguments);

switch (command) {
  case "validate-inputs": {
    const identity = await loadAndValidateIdentity(argumentsMap);
    console.log(`Release inputs are consistent for ${identity.tag} at ${identity.sourceCommit}.`);
    break;
  }
  case "plan": {
    const identity = await loadAndValidateIdentity(argumentsMap);
    const rendered = stableJson(identity);
    const output = optionalArgument(argumentsMap, "output");
    if (output) {
      await writeFile(resolve(repositoryRoot, output), rendered, "utf8");
      console.log(`Wrote deterministic release plan to ${output}.`);
    } else {
      process.stdout.write(rendered);
    }
    break;
  }
  case "checksums": {
    const tag = requiredArgument(argumentsMap, "tag");
    const directory = resolve(repositoryRoot, requiredArgument(argumentsMap, "directory"));
    const output = resolve(directory, "SHA256SUMS");
    await writeFile(output, await buildSha256Sums(directory, tag), "utf8");
    console.log(`Wrote ${output}.`);
    break;
  }
  case "verify-directory": {
    const tag = requiredArgument(argumentsMap, "tag");
    const directory = resolve(repositoryRoot, requiredArgument(argumentsMap, "directory"));
    const result = await verifyReleaseDirectory(directory, tag);
    console.log(
      `Verified ${result.files.length} release assets and ${result.verifiedDigests} recorded digests.`,
    );
    break;
  }
  default:
    throw new Error(
      "RELEASE_COMMAND_INVALID: use validate-inputs, plan, checksums, or verify-directory.",
    );
}

async function loadAndValidateIdentity(argumentsMap) {
  const tag = requiredArgument(argumentsMap, "tag");
  const rootPackage = await readJson("package.json");
  const mobilePackage = await readJson("apps/mobile/package.json");
  const appConfig = await readJson("apps/mobile/app.json");
  const head = runGit(["rev-parse", "HEAD"]);
  const requestedCommit = optionalArgument(argumentsMap, "source-commit") ?? head;
  if (requestedCommit !== head) {
    throw new Error(
      `RELEASE_SOURCE_MISMATCH: requested source commit ${requestedCommit} does not match HEAD ${head}.`,
    );
  }
  const status = runGit(["status", "--porcelain=v1", "--untracked-files=all"]);
  if (status.length !== 0) {
    throw new Error(
      "RELEASE_WORKTREE_DIRTY: commit or remove local changes before release staging.",
    );
  }

  return validateReleaseIdentity({
    tag,
    sourceCommit: requestedCommit,
    rootVersion: rootPackage.version,
    mobileVersion: mobilePackage.version,
    expoVersion: appConfig.expo?.version,
    versionCode: appConfig.expo?.android?.versionCode,
    packageName: appConfig.expo?.android?.package,
  });
}

async function readJson(path) {
  try {
    return JSON.parse(await readFile(resolve(repositoryRoot, path), "utf8"));
  } catch (cause) {
    throw new Error(`RELEASE_INPUT_INVALID: unable to read ${path}.`, { cause });
  }
}

function runGit(args) {
  const result = spawnSync("git", args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    shell: false,
  });
  if (result.error || result.status !== 0) {
    throw new Error(`RELEASE_GIT_FAILED: git ${args.join(" ")} failed.`, {
      cause: result.error ?? new Error(result.stderr.trim()),
    });
  }
  return result.stdout.trim();
}

function parseArguments(values) {
  const result = new Map();
  for (let index = 0; index < values.length; index += 1) {
    const key = values[index];
    if (!key.startsWith("--") || key.length === 2) {
      throw new Error(
        `RELEASE_ARGUMENT_INVALID: expected --name, received ${JSON.stringify(key)}.`,
      );
    }
    const name = key.slice(2);
    const value = values[index + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`RELEASE_ARGUMENT_INVALID: --${name} requires a value.`);
    }
    if (result.has(name)) {
      throw new Error(`RELEASE_ARGUMENT_INVALID: --${name} was provided more than once.`);
    }
    result.set(name, value);
    index += 1;
  }
  return result;
}

function requiredArgument(argumentsMap, name) {
  const value = argumentsMap.get(name);
  if (!value) {
    throw new Error(`RELEASE_ARGUMENT_INVALID: --${name} is required.`);
  }
  return value;
}

function optionalArgument(argumentsMap, name) {
  return argumentsMap.get(name);
}
