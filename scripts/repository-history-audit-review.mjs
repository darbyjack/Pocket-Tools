import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));

function sanitizeGitleaksFindings(findings) {
  if (!Array.isArray(findings)) {
    throw new Error("HISTORY_AUDIT_REVIEW_INVALID: Gitleaks JSON report must be an array.");
  }

  return findings
    .map((finding) => ({
      ruleId: stringOrNull(finding?.RuleID),
      description: stringOrNull(finding?.Description),
      file: stringOrNull(finding?.File),
      commit: stringOrNull(finding?.Commit),
      startLine: integerOrNull(finding?.StartLine),
      endLine: integerOrNull(finding?.EndLine),
    }))
    .sort(
      (a, b) =>
        String(a.file).localeCompare(String(b.file)) ||
        String(a.commit).localeCompare(String(b.commit)) ||
        (a.startLine ?? 0) - (b.startLine ?? 0) ||
        String(a.ruleId).localeCompare(String(b.ruleId)),
    );
}

function stringOrNull(value) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function integerOrNull(value) {
  return Number.isSafeInteger(value) ? value : null;
}

function parseArguments(argv) {
  const options = {
    input: resolve(repositoryRoot, "release-work", "history-audit", "gitleaks.json"),
    output: resolve(repositoryRoot, "release-work", "history-audit", "gitleaks-review.json"),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--input") options.input = resolve(repositoryRoot, argv[++index]);
    else if (argument === "--output") options.output = resolve(repositoryRoot, argv[++index]);
    else throw new Error(`HISTORY_AUDIT_REVIEW_ARGUMENT: unsupported argument ${argument}.`);
  }

  return options;
}

async function sha256File(path) {
  const data = await readFile(path);
  return createHash("sha256").update(data).digest("hex");
}

async function addReviewChecksum(outputPath) {
  const checksumPath = join(dirname(outputPath), "SHA256SUMS");
  const outputName = outputPath.slice(dirname(outputPath).length + 1).replaceAll("\\", "/");
  const existing = (await readFile(checksumPath, "utf8"))
    .split(/\r?\n/)
    .filter(Boolean)
    .filter((line) => !line.endsWith(`  ${outputName}`));
  existing.push(`${await sha256File(outputPath)}  ${outputName}`);
  existing.sort((a, b) => a.slice(66).localeCompare(b.slice(66)));
  await writeFile(checksumPath, `${existing.join("\n")}\n`, "utf8");
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const raw = JSON.parse(await readFile(options.input, "utf8"));
  const sanitized = sanitizeGitleaksFindings(raw);
  await writeFile(options.output, `${JSON.stringify(sanitized, null, 2)}\n`, "utf8");
  await addReviewChecksum(options.output);
  console.log(`Wrote ${sanitized.length} sanitized Gitleaks finding(s) to ${options.output}.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}

export { parseArguments, sanitizeGitleaksFindings };
