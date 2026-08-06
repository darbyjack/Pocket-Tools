import { readdir } from "node:fs/promises";
import { extname, join, resolve } from "node:path";

import { REQUIRED_NATIVE_LIBRARIES } from "./android-release-tools.mjs";
import {
  RELEASE_ABIS,
  RELEASE_PACKAGE_NAME,
  RELEASE_SDK_LEVELS,
  parseReleaseTag,
} from "./release-contract.mjs";

export function validateReleaseAbi(abi) {
  if (!RELEASE_ABIS.includes(abi)) {
    throw new Error(
      `ANDROID_BUILD_ARGUMENT_INVALID: ABI must be one of ${RELEASE_ABIS.join(", ")}.`,
    );
  }
  return abi;
}

export function intermediateApkFilename(tag, abi) {
  const parsed = parseReleaseTag(tag);
  validateReleaseAbi(abi);
  return `pocket-tools-${parsed.tag}-${abi}-unsigned.apk`;
}

export function intermediateInspectionFilename(tag, abi) {
  return `${intermediateApkFilename(tag, abi)}.inspection.json`;
}

export function buildPnpmCommand(
  args,
  {
    nodeExecutable = process.execPath,
    pnpmEntry = process.env.npm_execpath,
    repositoryRoot = process.cwd(),
  } = {},
) {
  if (typeof pnpmEntry !== "string" || pnpmEntry.trim().length === 0) {
    throw new Error(
      "ANDROID_BUILD_PNPM_MISSING: invoke the release build through pnpm so npm_execpath identifies the pinned pnpm CLI.",
    );
  }

  const entry = resolve(pnpmEntry);
  const extension = extname(entry).toLowerCase();
  if (extension === ".cmd" || extension === ".bat") {
    throw new Error(
      "ANDROID_BUILD_PNPM_UNSUPPORTED: npm_execpath must identify a native executable or JavaScript pnpm entrypoint, not a command-shell wrapper.",
    );
  }

  const javascriptEntry = extension === ".js" || extension === ".cjs" || extension === ".mjs";
  return {
    executable: javascriptEntry ? nodeExecutable : entry,
    args: javascriptEntry ? [entry, ...args] : [...args],
    cwd: resolve(repositoryRoot),
  };
}

export function buildExpoPrebuildCommand(options = {}) {
  return buildPnpmCommand(
    [
      "--dir",
      "apps/mobile",
      "exec",
      "expo",
      "prebuild",
      "--platform",
      "android",
      "--clean",
      "--no-install",
    ],
    options,
  );
}

export function buildGradleCommand({
  androidDirectory,
  abi,
  projectCacheDirectory,
  javaExecutable,
}) {
  validateReleaseAbi(abi);
  if (typeof javaExecutable !== "string" || javaExecutable.trim().length === 0) {
    throw new Error("ANDROID_BUILD_JAVA_MISSING: a discovered Java executable is required.");
  }
  const resolvedAndroidDirectory = resolve(androidDirectory);
  return {
    executable: javaExecutable,
    args: [
      "-classpath",
      resolve(resolvedAndroidDirectory, "gradle", "wrapper", "gradle-wrapper.jar"),
      "org.gradle.wrapper.GradleWrapperMain",
      ":app:assembleRelease",
      `-PreactNativeArchitectures=${abi}`,
      "--no-daemon",
      "--stacktrace",
      "--project-cache-dir",
      resolve(projectCacheDirectory),
    ],
    cwd: resolvedAndroidDirectory,
  };
}

export function validateGeneratedGradleProperties(text) {
  const properties = parseProperties(text);
  const architectures = String(properties.get("reactNativeArchitectures") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (JSON.stringify(architectures) !== JSON.stringify(RELEASE_ABIS)) {
    throw new Error(
      `ANDROID_BUILD_CONFIG_INVALID: reactNativeArchitectures must be ${RELEASE_ABIS.join(",")}.`,
    );
  }
  for (const name of [
    "android.enableMinifyInReleaseBuilds",
    "android.enableShrinkResourcesInReleaseBuilds",
  ]) {
    if (properties.get(name) !== "true") {
      throw new Error(`ANDROID_BUILD_CONFIG_INVALID: ${name} must be true.`);
    }
  }
  return {
    reactNativeArchitectures: architectures,
    minifyRelease: true,
    shrinkResourcesRelease: true,
  };
}

export async function findSingleReleaseApk(directory) {
  const matches = [];
  await collectApks(resolve(directory), matches);
  if (matches.length !== 1) {
    throw new Error(
      `ANDROID_BUILD_OUTPUT_INVALID: expected exactly one release APK, found ${matches.length}.`,
    );
  }
  return matches[0];
}

export function assertUnsignedApkVerification(result) {
  if (result.error) {
    throw new Error("ANDROID_BUILD_SIGNATURE_CHECK_FAILED: apksigner could not be executed.", {
      cause: result.error,
    });
  }
  if (result.status === 0) {
    throw new Error(
      "ANDROID_BUILD_INTERMEDIATE_SIGNED: release intermediate is already signed and cannot enter centralized signing.",
    );
  }
  return true;
}

export function validateUnsignedApkInspection({ badging, nativeLibraries, expected, aligned }) {
  const failures = [];
  compareField(
    failures,
    "package",
    badging.packageName,
    expected.packageName ?? RELEASE_PACKAGE_NAME,
  );
  compareField(failures, "versionName", badging.versionName, expected.versionName);
  compareField(failures, "versionCode", badging.versionCode, expected.versionCode);
  compareField(failures, "minSdk", badging.minSdk, expected.minSdk ?? RELEASE_SDK_LEVELS.min);
  compareField(
    failures,
    "compileSdk",
    badging.compileSdk,
    expected.compileSdk ?? RELEASE_SDK_LEVELS.compile,
  );
  compareField(
    failures,
    "targetSdk",
    badging.targetSdk,
    expected.targetSdk ?? RELEASE_SDK_LEVELS.target,
  );
  if (badging.debuggable) failures.push("manifest is debuggable");
  if (badging.testOnly) failures.push("manifest is testOnly");
  if (!aligned) failures.push("APK is not zipaligned for 16 KiB native-library pages");

  const expectedAbi = validateReleaseAbi(expected.abi);
  const badgingAbis = [...badging.nativeAbis].sort(bytewiseCompare);
  if (badgingAbis.length !== 1 || badgingAbis[0] !== expectedAbi) {
    failures.push(
      `badging native ABIs are [${badgingAbis.join(", ")}] instead of [${expectedAbi}]`,
    );
  }
  const archiveAbis = Object.keys(nativeLibraries).sort(bytewiseCompare);
  if (archiveAbis.length !== 1 || archiveAbis[0] !== expectedAbi) {
    failures.push(
      `archive native ABIs are [${archiveAbis.join(", ")}] instead of [${expectedAbi}]`,
    );
  }
  const names = nativeLibraries[expectedAbi] ?? [];
  for (const required of REQUIRED_NATIVE_LIBRARIES) {
    if (!names.includes(required)) failures.push(`${required} is missing for ${expectedAbi}`);
  }
  if (failures.length !== 0) {
    throw new Error(`ANDROID_BUILD_INSPECTION_FAILED: ${failures.join("; ")}.`);
  }
  return {
    packageName: badging.packageName,
    versionName: badging.versionName,
    versionCode: badging.versionCode,
    sdk: {
      min: badging.minSdk,
      compile: badging.compileSdk,
      target: badging.targetSdk,
    },
    abi: expectedAbi,
    nativeLibraries: names,
    aligned: true,
    signed: false,
  };
}

function parseProperties(text) {
  const result = new Map();
  for (const rawLine of String(text).replace(/\r\n?/g, "\n").split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || line.startsWith("!")) continue;
    const separator = line.search(/[:=]/);
    const key = (separator === -1 ? line : line.slice(0, separator)).trim();
    const value = (separator === -1 ? "" : line.slice(separator + 1)).trim();
    result.set(key, value);
  }
  return result;
}

async function collectApks(directory, matches) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await collectApks(path, matches);
    else if (entry.isFile() && entry.name.endsWith(".apk")) matches.push(path);
  }
}

function compareField(failures, label, actual, expected) {
  if (actual !== expected) {
    failures.push(`${label} ${JSON.stringify(actual)} does not match ${JSON.stringify(expected)}`);
  }
}

function bytewiseCompare(left, right) {
  return Buffer.from(left).compare(Buffer.from(right));
}
