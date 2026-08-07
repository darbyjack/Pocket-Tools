import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  normalizeAndroidLicenseReport,
  normalizePnpmLicenseReport,
  stableJson,
  validateInventory,
} from "./license-lib.mjs";

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const policyPath = join(repositoryRoot, "licenses", "policy.json");
const overridesPath = join(repositoryRoot, "licenses", "overrides.json");
const pnpmInventoryPath = join(repositoryRoot, "licenses", "pnpm-production.json");
const androidInventoryPath = join(repositoryRoot, "licenses", "android-production.json");
const androidRawPath = join(repositoryRoot, "licenses", ".android-production.raw.json");
const HOST_SPECIFIC_OPTIONAL_PACKAGE_PATTERNS = [
  /^lightningcss(?:-cli)?-(?:android|darwin|freebsd|linux|win32)-/,
  /^@typescript\/typescript-(?:aix|darwin|freebsd|linux|netbsd|openbsd|sunos|win32)-/,
];

const command = process.argv[2];
const policy = await readJson(policyPath);
const overrides = await readJson(overridesPath);
assertPolicyFiles(policy, overrides);

switch (command) {
  case "pnpm:write":
    await writeInventory(pnpmInventoryPath, createPnpmInventory());
    break;
  case "pnpm:check":
    await checkInventory(pnpmInventoryPath, createPnpmInventory(), "pnpm licenses:pnpm:write");
    break;
  case "android:write":
    await writeInventory(androidInventoryPath, await createAndroidInventory());
    break;
  case "android:check":
    validateInventory(
      await readRequiredJson(androidInventoryPath, "pnpm licenses:android:write"),
      policy,
    );
    console.log("Android production license inventory is valid.");
    break;
  case "check":
    await checkInventory(pnpmInventoryPath, createPnpmInventory(), "pnpm licenses:pnpm:write");
    validateInventory(
      await readRequiredJson(androidInventoryPath, "pnpm licenses:android:write"),
      policy,
    );
    console.log("All production license inventories are valid and current.");
    break;
  default:
    throw new Error(
      "LICENSE_COMMAND_INVALID: use pnpm:write, pnpm:check, android:write, android:check, or check.",
    );
}

function createPnpmInventory() {
  const args = ["licenses", "list", "--prod", "--json"];
  const invocation = resolvePnpmInvocation(args);
  const result = spawnSync(invocation.executable, invocation.args, {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(
      `LICENSE_PNPM_FAILED: pnpm licenses list failed.\n${result.stderr || result.stdout}`,
    );
  }
  const raw = omitHostSpecificOptionalPackages(parseJsonOutput(result.stdout, "pnpm"));
  return normalizePnpmLicenseReport(raw, policy, overrides);
}

async function createAndroidInventory() {
  const androidRoot = join(repositoryRoot, "apps", "mobile", "android");
  const gradleWrapper = join(androidRoot, process.platform === "win32" ? "gradlew.bat" : "gradlew");
  if (!existsSync(gradleWrapper)) {
    throw new Error(
      "LICENSE_ANDROID_MISSING: generate apps/mobile/android with `pnpm --dir apps/mobile exec expo prebuild --platform android --clean --no-install` before running this command.",
    );
  }

  const initScript = join(repositoryRoot, "scripts", "gradle-license-inventory.gradle");
  const gradleArgs = [
    "-I",
    initScript,
    ":app:pocketToolsLicenseInventory",
    `-DpocketToolsLicenseOutput=${androidRawPath}`,
    "--no-daemon",
  ];
  const invocation = resolveGradleInvocation(androidRoot, gradleWrapper, gradleArgs);
  const result = spawnSync(invocation.executable, invocation.args, {
    cwd: androidRoot,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(
      `LICENSE_ANDROID_FAILED: Gradle license inventory failed.\n${result.stderr || result.stdout}`,
    );
  }

  try {
    const raw = await readJson(androidRawPath);
    assertAndroidReviewQueueEmpty(raw);
    return normalizeAndroidLicenseReport(raw, policy, overrides);
  } finally {
    await unlink(androidRawPath).catch(() => undefined);
  }
}

function resolvePnpmInvocation(args) {
  if (process.platform !== "win32") {
    return { executable: "pnpm", args };
  }

  return {
    executable: process.env.ComSpec ?? "cmd.exe",
    args: ["/d", "/s", "/c", "pnpm", ...args],
  };
}

function resolveGradleInvocation(androidRoot, gradleWrapper, args) {
  if (process.platform !== "win32") {
    return { executable: gradleWrapper, args };
  }

  const wrapperJar = join(androidRoot, "gradle", "wrapper", "gradle-wrapper.jar");
  if (!existsSync(wrapperJar)) {
    throw new Error(
      "LICENSE_ANDROID_MISSING: Gradle wrapper JAR is missing from the generated Android project.",
    );
  }
  const javaExecutable = process.env.JAVA_HOME
    ? join(process.env.JAVA_HOME, "bin", "java.exe")
    : "java.exe";
  return {
    executable: javaExecutable,
    args: ["-classpath", wrapperJar, "org.gradle.wrapper.GradleWrapperMain", ...args],
  };
}

async function writeInventory(path, inventory) {
  validateInventory(inventory, policy);
  await writeFile(path, stableJson(inventory), "utf8");
  console.log(`Wrote ${inventory.packages.length} packages to ${path}.`);
}

async function checkInventory(path, actual, writeCommand) {
  validateInventory(actual, policy);
  const expected = await readRequiredJson(path, writeCommand);
  validateInventory(expected, policy);
  if (stableJson(actual) !== stableJson(expected)) {
    throw new Error(
      `LICENSE_INVENTORY_STALE: ${path} does not match the resolved dependency graph. Run \`${writeCommand}\` and review the diff.\n${describeInventoryDrift(expected, actual)}`,
    );
  }
  console.log(`${path} is current and valid.`);
}

function describeInventoryDrift(expected, actual) {
  const expectedPackages = packageMap(expected.packages);
  const actualPackages = packageMap(actual.packages);
  const committedOnly = [...expectedPackages.keys()].filter((key) => !actualPackages.has(key));
  const resolvedOnly = [...actualPackages.keys()].filter((key) => !expectedPackages.has(key));
  const changed = [...expectedPackages.keys()].filter(
    (key) =>
      actualPackages.has(key) &&
      stableJson(expectedPackages.get(key)) !== stableJson(actualPackages.get(key)),
  );

  return [
    formatInventoryDrift("Committed only", committedOnly),
    formatInventoryDrift("Resolved only", resolvedOnly),
    formatInventoryDrift("Metadata changed", changed),
  ].join("\n");
}

function packageMap(packages) {
  return new Map(
    packages.map((entry) => [`${entry.ecosystem}:${entry.name}@${entry.version}`, entry]),
  );
}

function formatInventoryDrift(label, entries) {
  if (entries.length === 0) return `${label}: none`;
  const visible = entries.sort().slice(0, 20);
  const remainder = entries.length - visible.length;
  return `${label}: ${visible.join(", ")}${remainder > 0 ? `, ... (${remainder} more)` : ""}`;
}

function assertAndroidReviewQueueEmpty(raw) {
  if (!Array.isArray(raw)) return;
  const failures = [];
  for (const entry of raw) {
    try {
      normalizeAndroidLicenseReport([entry], policy, overrides);
    } catch (cause) {
      const group = String(entry?.group ?? "unknown-group");
      const module = String(entry?.module ?? "unknown-module");
      const version = String(entry?.version ?? "unknown-version");
      const message = cause instanceof Error ? cause.message : String(cause);
      const resolutionDetail =
        typeof entry?.failure === "string" && entry.failure.trim().length > 0
          ? ` Resolution detail: ${entry.failure.trim()}`
          : "";
      failures.push(`${group}:${module}@${version}: ${message}${resolutionDetail}`);
    }
  }
  if (failures.length > 0) {
    throw new Error(`LICENSE_ANDROID_REVIEW_QUEUE:\n- ${failures.sort().join("\n- ")}`);
  }
}

function omitHostSpecificOptionalPackages(raw) {
  const omitted = [];
  const retain = (entry) => {
    if (!isHostSpecificOptionalPackage(entry)) return true;
    omitted.push(`${entry.name}@${formatVersions(entry)}`);
    return false;
  };

  let normalized;
  if (Array.isArray(raw)) {
    normalized = raw.filter(retain);
  } else if (raw !== null && typeof raw === "object") {
    normalized = Object.fromEntries(
      Object.entries(raw).map(([license, entries]) => [
        license,
        Array.isArray(entries) ? entries.filter(retain) : entries,
      ]),
    );
  } else {
    return raw;
  }

  if (omitted.length > 0) {
    console.log(
      `Excluded ${omitted.length} host-specific optional package(s) from the portable production inventory: ${omitted.sort().join(", ")}.`,
    );
  }
  return normalized;
}

function isHostSpecificOptionalPackage(entry) {
  if (entry === null || typeof entry !== "object") return false;
  const name = typeof entry.name === "string" ? entry.name : "";
  if (HOST_SPECIFIC_OPTIONAL_PACKAGE_PATTERNS.some((pattern) => pattern.test(name))) {
    return true;
  }
  if (!Array.isArray(entry.paths)) return false;
  return entry.paths.some((packagePath) => {
    try {
      const manifest = JSON.parse(readFileSync(join(String(packagePath), "package.json"), "utf8"));
      return [manifest.os, manifest.cpu, manifest.libc].some(
        (constraint) => Array.isArray(constraint) && constraint.length > 0,
      );
    } catch {
      return false;
    }
  });
}

function formatVersions(entry) {
  if (Array.isArray(entry.versions)) return entry.versions.join(",");
  return String(entry.version ?? "unknown");
}

function parseJsonOutput(output, source) {
  const objectIndex = output.indexOf("{");
  const arrayIndex = output.indexOf("[");
  const indexes = [objectIndex, arrayIndex].filter((index) => index >= 0);
  const start = indexes.length === 0 ? -1 : Math.min(...indexes);
  if (start < 0) throw new Error(`LICENSE_INVENTORY_INVALID: ${source} produced no JSON.`);
  try {
    return JSON.parse(output.slice(start));
  } catch (cause) {
    throw new Error(`LICENSE_INVENTORY_INVALID: ${source} produced malformed JSON.`, { cause });
  }
}

async function readRequiredJson(path, writeCommand) {
  if (!existsSync(path)) {
    throw new Error(`LICENSE_INVENTORY_MISSING: ${path} is missing. Run \`${writeCommand}\`.`);
  }
  return readJson(path);
}

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (cause) {
    throw new Error(`LICENSE_INVENTORY_INVALID: unable to read ${path}.`, { cause });
  }
}

function assertPolicyFiles(policyValue, overridesValue) {
  if (policyValue?.schemaVersion !== 1) {
    throw new Error("LICENSE_POLICY_INVALID: policy schemaVersion must be 1.");
  }
  if (overridesValue?.schemaVersion !== 1 || typeof overridesValue.packages !== "object") {
    throw new Error("LICENSE_POLICY_INVALID: overrides registry is invalid.");
  }
}
