import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const ciPath = resolve(repositoryRoot, ".github/workflows/ci.yml");
const releasePath = resolve(repositoryRoot, ".github/workflows/release-draft.yml");

async function workflows() {
  const [ci, release] = await Promise.all([
    readFile(ciPath, "utf8"),
    readFile(releasePath, "utf8"),
  ]);
  return { ci, release };
}

test("keeps untrusted pull-request code off persistent runners and secrets", async () => {
  const { ci, release } = await workflows();
  const combined = `${ci}\n${release}`;

  assert.doesNotMatch(combined, /self-hosted/u);
  assert.doesNotMatch(combined, /pull_request_target/u);
  assert.doesNotMatch(combined, /gradlew\s+clean|gradlew(?:\.bat)?[^\n]*\s:?[A-Za-z]*clean\b/u);
  assert.match(ci, /^permissions:\n  contents: read$/mu);
});

test("keeps the dependency-free classifier from requiring pnpm", async () => {
  const { ci } = await workflows();
  const classifyStart = ci.indexOf("\n  classify:\n");
  const fastStart = ci.indexOf("\n  fast:\n");
  assert.ok(classifyStart > 0 && fastStart > classifyStart);
  const classify = ci.slice(classifyStart, fastStart);

  assert.match(
    classify,
    /uses: actions\/setup-node@[0-9a-f]{40} # v5\n        with:\n          node-version: 24\.18\.0\n          package-manager-cache: false/u,
  );
  assert.doesNotMatch(classify, /uses: pnpm\/action-setup/u);
});

test("exposes one stable required CI aggregation job", async () => {
  const { ci } = await workflows();

  assert.match(ci, /^  required:\n    name: CI \/ required$/mu);
  assert.match(ci, /^    if: \$\{\{ always\(\) \}\}$/mu);
  assert.match(ci, /needs:\n      - classify\n      - fast\n      - android-smoke/u);
});

test("keeps every production signing secret inside the protected signing job", async () => {
  const { release } = await workflows();
  const signStart = release.indexOf("\n  sign:\n");
  const attestStart = release.indexOf("\n  attest:\n");
  assert.ok(signStart > 0 && attestStart > signStart);

  const beforeSign = release.slice(0, signStart);
  const sign = release.slice(signStart, attestStart);
  const afterSign = release.slice(attestStart);
  const secretNames = [
    "ANDROID_RELEASE_KEYSTORE_BASE64",
    "ANDROID_RELEASE_KEY_ALIAS",
    "ANDROID_RELEASE_KEYSTORE_PASSWORD",
    "ANDROID_RELEASE_KEY_PASSWORD",
  ];

  assert.match(sign, /^    environment: release$/mu);
  for (const name of secretNames) {
    assert.doesNotMatch(beforeSign, new RegExp(name, "u"));
    assert.match(sign, new RegExp(`secrets\\.${name}`, "u"));
    assert.doesNotMatch(afterSign, new RegExp(name, "u"));
  }
});

test("pins the permitted external actions to immutable commits", async () => {
  const { ci, release } = await workflows();
  const usesLines = `${ci}\n${release}`.split(/\r?\n/u).filter((line) => /^\s*- uses:/u.test(line));

  assert.ok(usesLines.length > 0);
  for (const line of usesLines) {
    const match = /^\s*- uses: ([^@\s]+)@([0-9a-f]{40})\s+#\s+(v\d+(?:\.\d+){0,2})$/u.exec(line);
    assert.ok(match, `unreviewed action reference: ${line}`);
    const owner = match[1].split("/")[0];
    assert.ok(owner === "actions" || owner === "pnpm", `unsupported action owner: ${owner}`);
  }
});

test("creates drafts only and preserves the human publication gate", async () => {
  const { release } = await workflows();

  assert.match(release, /gh release create[^\n]*--draft/u);
  assert.doesNotMatch(release, /--draft=false|--latest|gh release publish/u);
  assert.match(release, /^    permissions:\n      contents: write$/mu);
  assert.match(
    release,
    /^    permissions:\n      attestations: write\n      contents: read\n      id-token: write$/mu,
  );
});
