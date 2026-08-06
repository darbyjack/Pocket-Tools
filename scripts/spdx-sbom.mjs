import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildSpdxDocument,
  stableJson,
  validateInventory,
  validateSpdxDocument,
} from "./license-lib.mjs";

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const packagePath = join(repositoryRoot, "package.json");
const policyPath = join(repositoryRoot, "licenses", "policy.json");
const npmInventoryPath = join(repositoryRoot, "licenses", "pnpm-production.json");
const androidInventoryPath = join(repositoryRoot, "licenses", "android-production.json");
const sbomPath = join(repositoryRoot, "licenses", "pocket-tools.spdx.json");
const command = process.argv[2];

const packageManifest = await readJson(packagePath);
const policy = await readJson(policyPath);
const npmInventory = validateInventory(await readRequiredJson(npmInventoryPath), policy);
const androidInventory = validateInventory(await readRequiredJson(androidInventoryPath), policy);
const document = validateSpdxDocument(
  buildSpdxDocument({
    rootVersion: packageManifest.version,
    npmInventory,
    androidInventory,
    created: sourceDate(),
  }),
);

switch (command) {
  case "write":
    await writeFile(sbomPath, stableJson(document), "utf8");
    console.log(`Wrote SPDX 2.3 SBOM to ${sbomPath}.`);
    break;
  case "check": {
    const expected = validateSpdxDocument(await readRequiredJson(sbomPath));
    if (stableJson(document) !== stableJson(expected)) {
      throw new Error(
        "SBOM_STALE: licenses/pocket-tools.spdx.json does not match the current production inventories. Run `pnpm sbom:write` and review the diff.",
      );
    }
    const secondPass = validateSpdxDocument(
      buildSpdxDocument({
        rootVersion: packageManifest.version,
        npmInventory,
        androidInventory,
        created: sourceDate(),
      }),
    );
    if (stableJson(document) !== stableJson(secondPass)) {
      throw new Error("SBOM_NONDETERMINISTIC: repeated generation produced different output.");
    }
    console.log("SPDX 2.3 SBOM is valid, deterministic, and current.");
    break;
  }
  default:
    throw new Error("SBOM_COMMAND_INVALID: use write or check.");
}

function sourceDate() {
  const raw = process.env.SOURCE_DATE_EPOCH ?? "0";
  if (!/^\d+$/.test(raw)) {
    throw new Error("SBOM_INVALID: SOURCE_DATE_EPOCH must be a non-negative integer.");
  }
  const milliseconds = Number(raw) * 1000;
  if (!Number.isSafeInteger(milliseconds)) {
    throw new Error("SBOM_INVALID: SOURCE_DATE_EPOCH is outside the supported range.");
  }
  return new Date(milliseconds).toISOString();
}

async function readRequiredJson(path) {
  if (!existsSync(path)) {
    throw new Error(`SBOM_INPUT_MISSING: ${path} is missing.`);
  }
  return readJson(path);
}

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (cause) {
    throw new Error(`SBOM_INVALID: unable to read ${path}.`, { cause });
  }
}
