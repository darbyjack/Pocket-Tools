import { existsSync } from "node:fs";
import { readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

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
    validateInventory(await readRequiredJson(androidInventoryPath, "pnpm licenses:android:write"), policy);
    console.log("Android production license inventory is valid.");
    break;
  case "check":
    await checkInventory(pnpmInventoryPath, createPnpmInventory(), "pnpm licenses:pnpm:write");
    validateInventory(await readRequiredJson(androidInventoryPath, "pnpm licenses:android:write"), policy);
    console.log("All production license inventories are valid and current.");
    break;
  default:
    throw new Error(
      "LICENSE_COMMAND_INVALID: use pnpm:write, pnpm:check, android:write, android:check, or check.",
    );
}

function createPnpmInventory() {
  const executable = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  const result = spawnSync(executable, ["licenses", "list", "--prod", "--json"], {
    cwd: repositoryRoot,
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    throw new Error(
      `LICENSE_PNPM_FAILED: pnpm licenses list failed.\n${result.stderr || result.stdout}`,
    );
  }
  return normalizePnpmLicenseReport(parseJsonOutput(result.stdout, "pnpm"), policy, overrides);
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
  const result = spawnSync(
    gradleWrapper,
    [
      "-I",
      initScript,
      ":app:pocketToolsLicenseInventory",
      `-DpocketToolsLicenseOutput=${androidRawPath}`,
      "--no-daemon",
    ],
    {
      cwd: androidRoot,
      encoding: "utf8",
      shell: process.platform === "win32",
    },
  );
  if (result.status !== 0) {
    throw new Error(
      `LICENSE_ANDROID_FAILED: Gradle license inventory failed.\n${result.stderr || result.stdout}`,
    );
  }

  try {
    return normalizeAndroidLicenseReport(await readJson(androidRawPath), policy, overrides);
  } finally {
    await unlink(androidRawPath).catch(() => undefined);
  }
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
      `LICENSE_INVENTORY_STALE: ${path} does not match the resolved dependency graph. Run \`${writeCommand}\` and review the diff.`,
    );
  }
  console.log(`${path} is current and valid.`);
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
