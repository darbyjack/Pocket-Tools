import { lstat, readdir } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { loadUnsignedSigningProvenance } from "./android-release-provenance-tools.mjs";
import { RELEASE_ABIS, parseReleaseTag } from "./release-contract.mjs";

const SHA_PATTERN = /^[0-9a-f]{40}$/;

export function expectedUnsignedHandoffNames(tag) {
  const release = parseReleaseTag(tag);
  return RELEASE_ABIS.flatMap((abi) => {
    const apk = `pocket-tools-${release.tag}-${abi}-unsigned.apk`;
    return [apk, `${apk}.inspection.json`];
  });
}

export async function validateUnsignedHandoff({ directory, sourceCommit, tag }) {
  if (!SHA_PATTERN.test(String(sourceCommit))) {
    throw new Error(
      "CI_RELEASE_SOURCE_INVALID: source commit must be a lowercase 40-character SHA.",
    );
  }

  const root = resolve(directory);
  const expected = expectedUnsignedHandoffNames(tag).sort(bytewiseCompare);
  const entries = await readdir(root, { withFileTypes: true });
  const actual = [];

  for (const entry of entries) {
    const path = join(root, entry.name);
    const information = await lstat(path);
    if (!entry.isFile() || information.isSymbolicLink()) {
      throw new Error(
        `CI_RELEASE_INPUT_INVALID: ${entry.name} must be a regular non-symbolic file.`,
      );
    }
    actual.push(entry.name);
  }

  actual.sort(bytewiseCompare);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    const missing = expected.filter((name) => !actual.includes(name));
    const extra = actual.filter((name) => !expected.includes(name));
    throw new Error(
      `CI_RELEASE_INPUT_SET_INVALID: missing=[${missing.join(", ")}] extra=[${extra.join(", ")}].`,
    );
  }

  const verified = [];
  for (const abi of RELEASE_ABIS) {
    const apk = join(root, `pocket-tools-${tag}-${abi}-unsigned.apk`);
    const provenance = await loadUnsignedSigningProvenance({
      apkPath: apk,
      inspectionPath: `${apk}.inspection.json`,
      expectedSourceCommit: sourceCommit,
      expectedTag: tag,
      expectedAbi: abi,
    });
    verified.push({
      abi,
      apk: basename(apk),
      sourceCommit: provenance.sourceCommit,
      tag: provenance.tag,
    });
  }

  return {
    directory: root,
    files: expected,
    sourceCommit,
    tag: parseReleaseTag(tag).tag,
    verified,
  };
}

function bytewiseCompare(left, right) {
  return Buffer.from(left).compare(Buffer.from(right));
}

function parseArguments(argumentsList) {
  const command = argumentsList[0];
  if (command !== "validate-unsigned") {
    throw new Error("CI_RELEASE_COMMAND_INVALID: expected validate-unsigned.");
  }

  const values = new Map();
  for (let index = 1; index < argumentsList.length; index += 2) {
    const name = argumentsList[index];
    const value = argumentsList[index + 1];
    if (!name?.startsWith("--") || value === undefined) {
      throw new Error("CI_RELEASE_ARGUMENT_INVALID: expected --name value pairs.");
    }
    values.set(name.slice(2), value);
  }
  return values;
}

function requiredArgument(argumentsMap, name) {
  const value = argumentsMap.get(name);
  if (!value) throw new Error(`CI_RELEASE_ARGUMENT_REQUIRED: ${name}`);
  return value;
}

async function main() {
  const argumentsMap = parseArguments(process.argv.slice(2));
  const result = await validateUnsignedHandoff({
    directory: requiredArgument(argumentsMap, "directory"),
    sourceCommit: requiredArgument(argumentsMap, "source"),
    tag: requiredArgument(argumentsMap, "tag"),
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
