import { appendFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const RELEASE_ABIS = ["arm64-v8a", "x86_64"];

const DOCUMENTATION_ROOT_FILES = new Set([
  "ASSET_PROVENANCE.md",
  "CHANGELOG.md",
  "CODE_OF_CONDUCT.md",
  "CONTRIBUTING.md",
  "GOVERNANCE.md",
  "LICENSE",
  "PRIVACY.md",
  "README.md",
  "SECURITY.md",
  "SUPPORT.md",
  "THIRD_PARTY_NOTICES.md",
]);

const ANDROID_ROOT_FILES = new Set(["package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml"]);

function normalizePath(path) {
  return String(path)
    .replaceAll("\\", "/")
    .replace(/^\.\/+/, "");
}

function isDocumentationPath(path) {
  return (
    DOCUMENTATION_ROOT_FILES.has(path) ||
    path.startsWith("docs/") ||
    path.startsWith("apps/docs/") ||
    path.startsWith(".github/ISSUE_TEMPLATE/") ||
    (path.startsWith("release/") && path.endsWith(".md")) ||
    path === ".github/PULL_REQUEST_TEMPLATE.md" ||
    path === ".github/CODEOWNERS"
  );
}

function isAndroidPath(path) {
  return (
    ANDROID_ROOT_FILES.has(path) ||
    path.startsWith("apps/mobile/") ||
    path.startsWith("modules/pocket-quickjs/") ||
    path.startsWith("modules/pocket-notifications/") ||
    path.startsWith("packages/sdk-contract/") ||
    path.startsWith("examples/") ||
    path === ".github/workflows/ci.yml" ||
    path === ".github/workflows/release-draft.yml" ||
    path === "scripts/ci-paths.mjs" ||
    path === "scripts/ci-release-collect.mjs" ||
    path === "scripts/sync-bundled-mini-apps.mjs" ||
    path.startsWith("scripts/android-release-") ||
    path === "scripts/android-release.mjs"
  );
}

function isNativePath(path) {
  return (
    ANDROID_ROOT_FILES.has(path) ||
    path === "apps/mobile/app.json" ||
    path.startsWith("apps/mobile/plugins/") ||
    path.startsWith("modules/pocket-quickjs/android/") ||
    path.startsWith("modules/pocket-notifications/android/") ||
    path === ".github/workflows/ci.yml" ||
    path === ".github/workflows/release-draft.yml" ||
    path === "scripts/ci-paths.mjs" ||
    path === "scripts/ci-release-collect.mjs" ||
    path.startsWith("scripts/android-release-") ||
    path === "scripts/android-release.mjs" ||
    /(?:^|\/)(?:CMakeLists\.txt|[^/]+\.(?:c|cc|cpp|cxx|h|hpp|java|kt|kts|gradle))$/.test(path) ||
    path.endsWith(".gradle.kts")
  );
}

export function classifyPaths(paths) {
  const normalizedPaths = [...new Set(paths.map(normalizePath).filter(Boolean))].sort();
  const android = normalizedPaths.some(isAndroidPath);
  const native = normalizedPaths.some(isNativePath);
  const docsOnly = normalizedPaths.length > 0 && normalizedPaths.every(isDocumentationPath);
  const abis = android ? (native ? RELEASE_ABIS : ["arm64-v8a"]) : [];

  return {
    abis,
    android,
    docsOnly,
    native,
    paths: normalizedPaths,
  };
}

export function changedPaths({ base, head }) {
  const result = spawnSync("git", ["diff", "--name-only", "--diff-filter=ACMRD", base, head], {
    encoding: "utf8",
    shell: false,
  });
  if (result.error) {
    throw new Error(`CI_PATHS_GIT_FAILED: ${result.error.message}`, { cause: result.error });
  }
  if (result.status !== 0) {
    throw new Error(
      `CI_PATHS_GIT_FAILED: git diff exited ${result.status}: ${String(result.stderr).trim()}`,
    );
  }
  return String(result.stdout)
    .split(/\r?\n/u)
    .map((path) => path.trim())
    .filter(Boolean);
}

export function githubOutputs(classification) {
  return [
    `abis=${JSON.stringify(classification.abis)}`,
    `android=${classification.android}`,
    `docs_only=${classification.docsOnly}`,
    `native=${classification.native}`,
    `paths=${JSON.stringify(classification.paths)}`,
  ].join("\n");
}

function requiredArgument(argumentsMap, name) {
  const value = argumentsMap.get(name);
  if (!value) throw new Error(`CI_PATHS_ARGUMENT_REQUIRED: ${name}`);
  return value;
}

function parseArguments(argumentsList) {
  const command = argumentsList[0];
  if (command !== "classify") {
    throw new Error("CI_PATHS_COMMAND_INVALID: expected classify.");
  }
  const values = new Map();
  for (let index = 1; index < argumentsList.length; index += 2) {
    const name = argumentsList[index];
    const value = argumentsList[index + 1];
    if (!name?.startsWith("--") || value === undefined) {
      throw new Error("CI_PATHS_ARGUMENT_INVALID: expected --name value pairs.");
    }
    values.set(name.slice(2), value);
  }
  return values;
}

async function main() {
  const argumentsMap = parseArguments(process.argv.slice(2));
  const base = requiredArgument(argumentsMap, "base");
  const head = requiredArgument(argumentsMap, "head");
  const output = requiredArgument(argumentsMap, "github-output");
  const classification = classifyPaths(changedPaths({ base, head }));
  await appendFile(output, `${githubOutputs(classification)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify(classification, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
