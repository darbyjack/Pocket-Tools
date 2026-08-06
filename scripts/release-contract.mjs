import { createHash } from "node:crypto";
import { lstat, readFile, readdir } from "node:fs/promises";
import { basename, join } from "node:path";

export const RELEASE_CONTRACT_SCHEMA_VERSION = 1;
export const RELEASE_METADATA_SCHEMA = "pocket-tools-release-metadata";
export const RELEASE_PACKAGE_NAME = "com.darbyjack.pockettools";
export const RELEASE_ABIS = ["armeabi-v7a", "arm64-v8a", "x86", "x86_64"];
export const RELEASE_SDK_LEVELS = Object.freeze({ min: 24, compile: 36, target: 36 });

const TAG_PATTERN = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(alpha|beta|rc)\.([1-9]\d*))?$/;
const SHA_PATTERN = /^[0-9a-f]{40}$/;

export function parseReleaseTag(tag) {
  const normalized = requireText(tag, "tag");
  const match = TAG_PATTERN.exec(normalized);
  if (!match) {
    throw new Error(
      "RELEASE_TAG_INVALID: expected vMAJOR.MINOR.PATCH or vMAJOR.MINOR.PATCH-(alpha|beta|rc).N.",
    );
  }
  const prereleaseKind = match[4] ?? null;
  return {
    tag: normalized,
    version: normalized.slice(1),
    prerelease: prereleaseKind !== null,
    classification: prereleaseKind ?? "stable",
  };
}

export function expectedReleaseAssetNames(tag) {
  const identity = parseReleaseTag(tag);
  const prefix = `pocket-tools-${identity.tag}`;
  return [
    ...RELEASE_ABIS.map((abi) => `${prefix}-${abi}.apk`),
    `${prefix}-release.json`,
    `${prefix}.spdx.json`,
    `${prefix}-third-party-notices.txt`,
    "pocket-tools-release-certificate.pem",
    "SHA256SUMS",
  ];
}

export function validateReleaseIdentity(input) {
  const parsed = parseReleaseTag(input.tag);
  const sourceCommit = requireText(input.sourceCommit, "sourceCommit");
  if (!SHA_PATTERN.test(sourceCommit)) {
    throw new Error("RELEASE_IDENTITY_INVALID: sourceCommit must be a lowercase 40-character SHA.");
  }
  const versions = [
    ["root package", input.rootVersion],
    ["mobile package", input.mobileVersion],
    ["Expo", input.expoVersion],
  ];
  for (const [label, version] of versions) {
    if (version !== parsed.version) {
      throw new Error(
        `RELEASE_VERSION_MISMATCH: ${label} version ${JSON.stringify(version)} does not match ${parsed.version}.`,
      );
    }
  }
  if (input.packageName !== RELEASE_PACKAGE_NAME) {
    throw new Error(
      `RELEASE_PACKAGE_MISMATCH: expected ${RELEASE_PACKAGE_NAME}, received ${JSON.stringify(input.packageName)}.`,
    );
  }
  if (!Number.isSafeInteger(input.versionCode) || input.versionCode <= 0) {
    throw new Error(
      "RELEASE_VERSION_CODE_INVALID: android.versionCode must be a positive integer.",
    );
  }

  return {
    schema: RELEASE_METADATA_SCHEMA,
    schemaVersion: RELEASE_CONTRACT_SCHEMA_VERSION,
    tag: parsed.tag,
    version: parsed.version,
    versionCode: input.versionCode,
    packageName: RELEASE_PACKAGE_NAME,
    sourceCommit,
    classification: parsed.classification,
    prerelease: parsed.prerelease,
    sdk: RELEASE_SDK_LEVELS,
    abis: [...RELEASE_ABIS],
    assets: expectedReleaseAssetNames(parsed.tag),
  };
}

export function stableJson(value) {
  return `${JSON.stringify(sortJson(value), null, 2)}\n`;
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export async function buildSha256Sums(directory, tag) {
  const expected = expectedReleaseAssetNames(tag).filter((name) => name !== "SHA256SUMS");
  await assertExactAssetSet(directory, expected);
  const lines = [];
  for (const filename of bytewiseSort(expected)) {
    const bytes = await readFile(join(directory, filename));
    lines.push(`${sha256(bytes)}  ${filename}`);
  }
  return `${lines.join("\n")}\n`;
}

export async function verifyReleaseDirectory(directory, tag) {
  const expected = expectedReleaseAssetNames(tag);
  await assertExactAssetSet(directory, expected);
  const parsed = parseSha256Sums(await readFile(join(directory, "SHA256SUMS"), "utf8"));
  const checksummed = bytewiseSort(expected.filter((name) => name !== "SHA256SUMS"));
  const recordedNames = bytewiseSort([...parsed.keys()]);
  if (JSON.stringify(recordedNames) !== JSON.stringify(checksummed)) {
    throw new Error(
      "RELEASE_CHECKSUM_SET_INVALID: SHA256SUMS does not list the exact release asset set.",
    );
  }
  for (const filename of checksummed) {
    const actual = sha256(await readFile(join(directory, filename)));
    if (actual !== parsed.get(filename)) {
      throw new Error(`RELEASE_CHECKSUM_MISMATCH: ${filename} does not match SHA256SUMS.`);
    }
  }
  return { files: expected, verifiedDigests: checksummed.length };
}

export function parseSha256Sums(text) {
  const normalized = text.replace(/\r\n?/g, "\n");
  const lines = normalized.endsWith("\n")
    ? normalized.slice(0, -1).split("\n")
    : normalized.split("\n");
  if (lines.length === 0 || lines.some((line) => line.length === 0)) {
    throw new Error("RELEASE_CHECKSUM_FILE_INVALID: SHA256SUMS must contain non-empty lines.");
  }
  const result = new Map();
  for (const line of lines) {
    const match = /^([0-9a-f]{64})  ([a-z0-9][a-z0-9._-]*)$/.exec(line);
    if (!match) {
      throw new Error(`RELEASE_CHECKSUM_FILE_INVALID: malformed line ${JSON.stringify(line)}.`);
    }
    const [, digest, filename] = match;
    if (basename(filename) !== filename || filename === "SHA256SUMS") {
      throw new Error(
        `RELEASE_CHECKSUM_FILE_INVALID: unsupported entry ${JSON.stringify(filename)}.`,
      );
    }
    if (result.has(filename)) {
      throw new Error(`RELEASE_CHECKSUM_FILE_INVALID: duplicate entry ${filename}.`);
    }
    result.set(filename, digest);
  }
  const names = [...result.keys()];
  if (JSON.stringify(names) !== JSON.stringify(bytewiseSort(names))) {
    throw new Error("RELEASE_CHECKSUM_FILE_INVALID: entries must use bytewise filename ordering.");
  }
  return result;
}

async function assertExactAssetSet(directory, expected) {
  const names = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (!entry.isFile()) {
      throw new Error(`RELEASE_ASSET_SET_INVALID: ${entry.name} is not a regular file.`);
    }
    const stats = await lstat(join(directory, entry.name));
    if (stats.isSymbolicLink()) {
      throw new Error(`RELEASE_ASSET_SET_INVALID: ${entry.name} must not be a symbolic link.`);
    }
    names.push(entry.name);
  }
  const actual = bytewiseSort(names);
  const wanted = bytewiseSort(expected);
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    const missing = wanted.filter((name) => !actual.includes(name));
    const extra = actual.filter((name) => !wanted.includes(name));
    throw new Error(
      `RELEASE_ASSET_SET_INVALID: missing=[${missing.join(", ")}] extra=[${extra.join(", ")}].`,
    );
  }
}

function sortJson(value) {
  if (Array.isArray(value)) return value.map(sortJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort((left, right) => Buffer.from(left).compare(Buffer.from(right)))
        .map((key) => [key, sortJson(value[key])]),
    );
  }
  return value;
}

function bytewiseSort(values) {
  return [...values].sort((left, right) => Buffer.from(left).compare(Buffer.from(right)));
}

function requireText(value, path) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`RELEASE_INPUT_INVALID: ${path} must be non-empty text.`);
  }
  return value.trim();
}
