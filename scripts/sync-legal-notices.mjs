import { existsSync } from "node:fs";
import { readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const licensePath = join(repositoryRoot, "LICENSE");
const noticesPath = join(repositoryRoot, "THIRD_PARTY_NOTICES.md");
const outputPath = join(
  repositoryRoot,
  "apps",
  "mobile",
  "src",
  "generated",
  "legal-notices.json",
);
const legacyOutputPath = join(
  repositoryRoot,
  "apps",
  "mobile",
  "src",
  "generated",
  "legal-notices.ts",
);
const command = process.argv[2];

const [license, notices] = await Promise.all([
  readFile(licensePath, "utf8"),
  readFile(noticesPath, "utf8"),
]);
const output = `${JSON.stringify(
  {
    projectLicenseText: normalizeLineEndings(license),
    thirdPartyNoticesText: normalizeLineEndings(notices),
  },
  null,
  2,
)}\n`;

switch (command) {
  case "write":
    await rm(legacyOutputPath, { force: true });
    await writeFile(outputPath, output, "utf8");
    console.log(`Wrote bundled legal notices to ${outputPath}.`);
    break;
  case "check":
    if (existsSync(legacyOutputPath)) {
      throw new Error(
        "LEGAL_NOTICES_LEGACY: remove generated legal-notices.ts by running `pnpm legal:notices:write`.",
      );
    }
    if (!existsSync(outputPath)) {
      throw new Error(
        "LEGAL_NOTICES_MISSING: bundled legal notices are missing. Run `pnpm legal:notices:write`.",
      );
    }
    if ((await readFile(outputPath, "utf8")) !== output) {
      throw new Error(
        "LEGAL_NOTICES_STALE: bundled legal notices differ from LICENSE or THIRD_PARTY_NOTICES.md. Run `pnpm legal:notices:write` and review the diff.",
      );
    }
    console.log("Bundled legal notices match the canonical root files.");
    break;
  default:
    throw new Error("LEGAL_NOTICES_COMMAND_INVALID: use write or check.");
}

function normalizeLineEndings(value) {
  return value.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
}
