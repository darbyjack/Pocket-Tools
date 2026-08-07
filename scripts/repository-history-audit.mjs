import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const EXPECTED_GITLEAKS_VERSION = "8.30.0";
const DEFAULT_LARGE_BLOB_BYTES = 1024 * 1024;
const DEFAULT_CONTENT_SCAN_BYTES = 5 * 1024 * 1024;
const GITLEAKS_SELF_TEST_INPUT = `token = "${[
  "gh",
  "p_",
  "aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789",
].join("")}"\n`;

const SUSPICIOUS_PATH_RULES = [
  ["environment", /(^|\/)\.env(?:\.|$)/i],
  [
    "private-key",
    /(^|\/)(?:id_(?:rsa|dsa|ecdsa|ed25519)|.*\.(?:pem|key|p12|pfx|jks|keystore|crt|cer|der|csr))$/i,
  ],
  ["credentials", /(^|\/)(?:credentials?|secrets?|tokens?|passwords?|passwd)(?:[._-].*)?$/i],
  ["database", /\.(?:db|sqlite|sqlite3|backup|bak|dump|sql)$/i],
  ["package", /\.(?:apk|aab|apks|ipa|msix|exe|dll)$/i],
  ["archive", /\.(?:zip|7z|rar|tar|tgz|gz|bz2|xz)$/i],
  ["diagnostic", /\.(?:log|hprof)$/i],
  ["generated-android", /(^|\/)(?:apps\/mobile\/android|android)(?:\/|$)/i],
  ["generated-ios", /(^|\/)(?:apps\/mobile\/ios|ios)(?:\/|$)/i],
  ["local-config", /(^|\/)(?:local|signing|keystore)\.properties$/i],
];

const CONTENT_REVIEW_RULES = [
  ["windows-user-path", /\b[A-Za-z]:\\Users\\[^\\\r\n\t"' ]+/i],
  ["mac-user-path", /\/Users\/[^/\r\n\t"' ]+/],
  ["linux-user-path", /\/home\/[^/\r\n\t"' ]+/],
  [
    "private-network-url",
    /https?:\/\/(?:localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(?:1[6-9]|2\d|3[01])\.\d+\.\d+)(?::\d+)?/i,
  ],
  ["private-hostname-url", /https?:\/\/[^/\s"'`]*(?:\.internal|\.local)(?::\d+)?/i],
  ["database-url", /\b(?:mongodb(?:\+srv)?|postgres(?:ql)?|mysql|mariadb|redis):\/\//i],
  [
    "credential-assignment",
    /\b(?:password|passwd|secret|token|api[_-]?key|client[_-]?secret)\s*[:=]\s*[^\s"'`]{4,}/i,
  ],
];

function runGit(args, options = {}) {
  const result = spawnSync("git", args, {
    cwd: repositoryRoot,
    encoding: options.encoding ?? "utf8",
    input: options.input,
    maxBuffer: options.maxBuffer ?? 128 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(
      `HISTORY_AUDIT_GIT_FAILED: git ${args.join(" ")} failed.\n${result.stderr || result.stdout}`,
    );
  }
  return result.stdout;
}

function runCommand(executable, args, options = {}) {
  return spawnSync(executable, args, {
    cwd: repositoryRoot,
    encoding: Object.hasOwn(options, "encoding") ? options.encoding : "utf8",
    input: options.input,
    maxBuffer: options.maxBuffer ?? 128 * 1024 * 1024,
  });
}

function assertRepositoryReady() {
  if (runGit(["rev-parse", "--is-inside-work-tree"]).trim() !== "true") {
    throw new Error("HISTORY_AUDIT_NOT_REPOSITORY: run from a Git working tree.");
  }
  if (runGit(["rev-parse", "--is-shallow-repository"]).trim() !== "false") {
    throw new Error(
      "HISTORY_AUDIT_SHALLOW: the repository is shallow. Fetch complete history before auditing.",
    );
  }
  const status = runGit(["status", "--porcelain=v1", "--untracked-files=all"]).trim();
  if (status.length > 0) {
    throw new Error(
      "HISTORY_AUDIT_DIRTY: commit, stash, or remove worktree changes before auditing.",
    );
  }
}

function collectRefs() {
  const raw = runGit([
    "for-each-ref",
    "--format=%(refname)%09%(objectname)",
    "refs/heads",
    "refs/remotes",
    "refs/tags",
    "refs/pull",
  ]);
  return raw
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const [ref, object] = line.split("\t");
      return { ref, object };
    })
    .filter(({ ref }) => ref !== "refs/remotes/origin/HEAD")
    .sort((a, b) => a.ref.localeCompare(b.ref));
}

function collectObjectPaths() {
  const pathsByObject = new Map();
  const raw = runGit(["rev-list", "--objects", "--all"]);
  for (const line of raw.split(/\r?\n/)) {
    if (!line) continue;
    const space = line.indexOf(" ");
    const object = space < 0 ? line : line.slice(0, space);
    const path = space < 0 ? null : line.slice(space + 1);
    if (!pathsByObject.has(object)) pathsByObject.set(object, new Set());
    if (path) pathsByObject.get(object).add(path);
  }
  return pathsByObject;
}

function collectBlobMetadata(pathsByObject) {
  const objectLines = [...pathsByObject.keys()].map((object) => `${object}\n`).join("");
  const raw = runGit(
    ["cat-file", "--batch-check=%(objectname) %(objecttype) %(objectsize)"],
    { input: objectLines },
  );
  const blobs = [];
  for (const line of raw.split(/\r?\n/)) {
    if (!line) continue;
    const [object, type, rawSize] = line.split(" ");
    if (type !== "blob") continue;
    blobs.push({
      object,
      size: Number(rawSize),
      paths: [...(pathsByObject.get(object) ?? [])].sort(),
    });
  }
  return blobs;
}

function classifySuspiciousPaths(blobs) {
  const findings = [];
  for (const blob of blobs) {
    for (const path of blob.paths) {
      const categories = SUSPICIOUS_PATH_RULES.filter(([, pattern]) => pattern.test(path)).map(
        ([category]) => category,
      );
      if (categories.length === 0) continue;
      findings.push({
        object: blob.object,
        size: blob.size,
        path,
        categories,
      });
    }
  }
  return findings.sort((a, b) => a.path.localeCompare(b.path) || a.object.localeCompare(b.object));
}

function collectLargeBlobs(blobs, thresholdBytes) {
  return blobs
    .filter(({ size }) => size >= thresholdBytes)
    .map(({ object, size, paths }) => ({ object, size, paths }))
    .sort((a, b) => b.size - a.size || a.object.localeCompare(b.object));
}

function isProbablyBinary(buffer) {
  const sample = buffer.subarray(0, Math.min(buffer.length, 8192));
  return sample.includes(0);
}

function collectContentReviewFindings(blobs, maxBytes) {
  const findings = [];
  for (const blob of blobs) {
    if (blob.size > maxBytes) continue;
    const result = runCommand("git", ["cat-file", "blob", blob.object], {
      encoding: null,
      maxBuffer: Math.max(maxBytes * 2, 16 * 1024 * 1024),
    });
    if (result.status !== 0) {
      throw new Error(`HISTORY_AUDIT_BLOB_READ_FAILED: unable to read blob ${blob.object}.`);
    }
    const buffer = result.stdout;
    if (!Buffer.isBuffer(buffer) || isProbablyBinary(buffer)) continue;
    const text = buffer.toString("utf8");
    const categories = CONTENT_REVIEW_RULES.filter(([, pattern]) => pattern.test(text)).map(
      ([category]) => category,
    );
    if (categories.length === 0) continue;
    findings.push({
      object: blob.object,
      size: blob.size,
      paths: blob.paths,
      categories,
    });
  }
  return findings.sort((a, b) => a.object.localeCompare(b.object));
}

function getGitVersion() {
  return runGit(["--version"]).trim();
}

function getHead() {
  return runGit(["rev-parse", "HEAD"]).trim();
}

function resolveOptionalRef(ref) {
  const result = runCommand("git", ["rev-parse", "--verify", ref]);
  return result.status === 0 ? String(result.stdout).trim() : null;
}

function getGitleaksVersion(executable) {
  const result = runCommand(executable, ["version"]);
  if (result.status !== 0) {
    throw new Error(
      `HISTORY_AUDIT_GITLEAKS_FAILED: unable to execute ${executable}.\n${result.stderr || result.stdout}`,
    );
  }
  const match = String(result.stdout).match(/\b(\d+\.\d+\.\d+)\b/);
  if (!match) {
    throw new Error("HISTORY_AUDIT_GITLEAKS_VERSION: unable to parse Gitleaks version.");
  }
  return match[1];
}

function assertGitleaksSelfTestResult(result) {
  if (result.status === 1) return;
  if (result.status === 0) {
    throw new Error(
      "HISTORY_AUDIT_GITLEAKS_SELF_TEST: Gitleaks failed to detect the synthetic GitHub token; refusing to trust the scan.",
    );
  }
  throw new Error(
    `HISTORY_AUDIT_GITLEAKS_SELF_TEST: Gitleaks self-test exited with ${result.status}.\n${result.stderr || ""}`,
  );
}

function selfTestGitleaks(executable) {
  const result = runCommand(
    executable,
    ["stdin", "--redact=100", "--no-banner", "--no-color"],
    { input: GITLEAKS_SELF_TEST_INPUT },
  );
  assertGitleaksSelfTestResult(result);
}

function runGitleaks(executable, reportPath) {
  const version = getGitleaksVersion(executable);
  if (version !== EXPECTED_GITLEAKS_VERSION) {
    throw new Error(
      `HISTORY_AUDIT_GITLEAKS_VERSION: expected ${EXPECTED_GITLEAKS_VERSION}, found ${version}.`,
    );
  }
  selfTestGitleaks(executable);
  const result = runCommand(executable, [
    "git",
    "--redact=100",
    "--no-banner",
    "--no-color",
    "--report-format=json",
    `--report-path=${reportPath}`,
    "--log-opts=--all",
    ".",
  ]);
  if (result.status !== 0 && result.status !== 1) {
    throw new Error(
      `HISTORY_AUDIT_GITLEAKS_FAILED: Gitleaks exited with ${result.status}.\n${result.stderr || result.stdout}`,
    );
  }
  return { version, findings: result.status === 1 };
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function sha256File(path) {
  const data = await readFile(path);
  return createHash("sha256").update(data).digest("hex");
}

async function writeChecksums(outputDirectory, files) {
  const entries = [];
  for (const filename of [...files].sort()) {
    entries.push(`${await sha256File(join(outputDirectory, filename))}  ${filename}`);
  }
  await writeFile(join(outputDirectory, "SHA256SUMS"), `${entries.join("\n")}\n`, "utf8");
}

function parseArguments(argv) {
  const options = {
    output: resolve(repositoryRoot, "release-work", "history-audit"),
    gitleaks: "gitleaks",
    largeBlobBytes: DEFAULT_LARGE_BLOB_BYTES,
    contentScanBytes: DEFAULT_CONTENT_SCAN_BYTES,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--output") options.output = resolve(repositoryRoot, argv[++index]);
    else if (argument === "--gitleaks") options.gitleaks = argv[++index];
    else if (argument === "--large-blob-bytes") options.largeBlobBytes = Number(argv[++index]);
    else if (argument === "--content-scan-bytes") options.contentScanBytes = Number(argv[++index]);
    else throw new Error(`HISTORY_AUDIT_ARGUMENT: unsupported argument ${argument}.`);
  }
  for (const key of ["largeBlobBytes", "contentScanBytes"]) {
    if (!Number.isSafeInteger(options[key]) || options[key] < 1) {
      throw new Error(`HISTORY_AUDIT_ARGUMENT: ${key} must be a positive integer.`);
    }
  }
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  assertRepositoryReady();
  await mkdir(options.output, { recursive: true });

  const refs = collectRefs();
  const pathsByObject = collectObjectPaths();
  const blobs = collectBlobMetadata(pathsByObject);
  const suspiciousPaths = classifySuspiciousPaths(blobs);
  const largeBlobs = collectLargeBlobs(blobs, options.largeBlobBytes);
  const contentReviewFindings = collectContentReviewFindings(blobs, options.contentScanBytes);
  const gitleaksReportPath = join(options.output, "gitleaks.json");
  const gitleaks = runGitleaks(options.gitleaks, gitleaksReportPath);
  try {
    await readFile(gitleaksReportPath);
  } catch {
    await writeJson(gitleaksReportPath, []);
  }

  const summary = {
    schemaVersion: 1,
    auditedHead: getHead(),
    auditedOriginMain: resolveOptionalRef("refs/remotes/origin/main"),
    generatedAt: new Date().toISOString(),
    toolchain: {
      git: getGitVersion(),
      node: process.version,
      gitleaks: gitleaks.version,
    },
    scope: {
      refs: refs.length,
      objects: pathsByObject.size,
      blobs: blobs.length,
      pullRefs: refs.filter(({ ref }) => ref.startsWith("refs/pull/")).length,
      remoteRefs: refs.filter(({ ref }) => ref.startsWith("refs/remotes/")).length,
      tagRefs: refs.filter(({ ref }) => ref.startsWith("refs/tags/")).length,
    },
    thresholds: {
      largeBlobBytes: options.largeBlobBytes,
      contentScanBytes: options.contentScanBytes,
    },
    findings: {
      gitleaks: gitleaks.findings,
      suspiciousPaths: suspiciousPaths.length,
      largeBlobs: largeBlobs.length,
      contentReview: contentReviewFindings.length,
    },
  };

  await writeJson(join(options.output, "refs.json"), refs);
  await writeJson(join(options.output, "suspicious-paths.json"), suspiciousPaths);
  await writeJson(join(options.output, "large-blobs.json"), largeBlobs);
  await writeJson(join(options.output, "content-review.json"), contentReviewFindings);
  await writeJson(join(options.output, "summary.json"), summary);

  await writeChecksums(options.output, [
    "content-review.json",
    "gitleaks.json",
    "large-blobs.json",
    "refs.json",
    "summary.json",
    "suspicious-paths.json",
  ]);

  console.log(`History audit written to ${options.output}.`);
  console.log(
    `Refs: ${summary.scope.refs}; blobs: ${summary.scope.blobs}; Gitleaks findings: ${gitleaks.findings ? "yes" : "no"}.`,
  );
  if (
    gitleaks.findings ||
    suspiciousPaths.length > 0 ||
    largeBlobs.length > 0 ||
    contentReviewFindings.length > 0
  ) {
    console.log("Review findings before public cutover; findings are not automatically accepted.");
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}

export {
  CONTENT_REVIEW_RULES,
  SUSPICIOUS_PATH_RULES,
  assertGitleaksSelfTestResult,
  classifySuspiciousPaths,
  collectLargeBlobs,
  parseArguments,
};
