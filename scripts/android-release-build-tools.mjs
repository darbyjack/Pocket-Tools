import { readdir } from "node:fs/promises";
import { join, resolve } from "node:path";

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

export function buildExpoPrebuildCommand(platform = process.platform) {
  return {
    executable: platform === "win32" ? "pnpm.cmd" : "pnpm",
    args: [
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
  };
}

export function buildGradleCommand({ androidDirectory, abi, projectCacheDirectory, platform }) {
  validateReleaseAbi(abi);
  const executable = resolve(androidDirectory, platform === "win32" ? "gradlew.bat" : "gradlew");
  return {
    executable,
    args: [
      ":app:assembleRelease",
      `-PreactNativeArchitectures=${abi}`,
      "--no-daemon",
      "--stacktrace",
      "--project-cache-dir",
      resolve(projectCacheDirectory),
    ],
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
