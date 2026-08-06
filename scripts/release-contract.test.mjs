import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  buildSha256Sums,
  expectedReleaseAssetNames,
  parseReleaseTag,
  stableJson,
  validateReleaseIdentity,
  verifyReleaseDirectory,
} from "./release-contract.mjs";

const SHA = "0123456789abcdef0123456789abcdef01234567";

test("parses supported stable and prerelease tags", () => {
  assert.deepEqual(parseReleaseTag("v1.2.3"), {
    tag: "v1.2.3",
    version: "1.2.3",
    prerelease: false,
    classification: "stable",
  });
  assert.equal(parseReleaseTag("v0.1.0-rc.2").classification, "rc");
  assert.throws(() => parseReleaseTag("1.2.3"), /RELEASE_TAG_INVALID/);
  assert.throws(() => parseReleaseTag("v1.2.3-preview.1"), /RELEASE_TAG_INVALID/);
});

test("validates release identity and mirrored versions", () => {
  const identity = validateReleaseIdentity({
    tag: "v0.1.0",
    rootVersion: "0.1.0",
    mobileVersion: "0.1.0",
    expoVersion: "0.1.0",
    versionCode: 1,
    packageName: "com.darbyjack.pockettools",
    sourceCommit: SHA,
  });
  assert.equal(identity.assets.length, 9);
  assert.equal(identity.prerelease, false);
  assert.throws(
    () =>
      validateReleaseIdentity({
        tag: "v0.1.0",
        rootVersion: "0.1.1",
        mobileVersion: "0.1.0",
        expoVersion: "0.1.0",
        versionCode: 1,
        packageName: "com.darbyjack.pockettools",
        sourceCommit: SHA,
      }),
    /RELEASE_VERSION_MISMATCH/,
  );
});

test("uses the exact official asset names", () => {
  assert.deepEqual(expectedReleaseAssetNames("v0.1.0-alpha.1"), [
    "pocket-tools-v0.1.0-alpha.1-armeabi-v7a.apk",
    "pocket-tools-v0.1.0-alpha.1-arm64-v8a.apk",
    "pocket-tools-v0.1.0-alpha.1-x86.apk",
    "pocket-tools-v0.1.0-alpha.1-x86_64.apk",
    "pocket-tools-v0.1.0-alpha.1-release.json",
    "pocket-tools-v0.1.0-alpha.1.spdx.json",
    "pocket-tools-v0.1.0-alpha.1-third-party-notices.txt",
    "pocket-tools-release-certificate.pem",
    "SHA256SUMS",
  ]);
});

test("serializes JSON with stable key ordering", () => {
  assert.equal(
    stableJson({ z: 1, a: { y: 2, b: 3 } }),
    '{\n  "a": {\n    "b": 3,\n    "y": 2\n  },\n  "z": 1\n}\n',
  );
});

test("generates and verifies the exact staged asset set", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pocket-tools-release-contract-"));
  const tag = "v0.1.0";
  try {
    for (const filename of expectedReleaseAssetNames(tag).filter((name) => name !== "SHA256SUMS")) {
      await writeFile(join(directory, filename), `fixture:${filename}\n`);
    }
    await writeFile(join(directory, "SHA256SUMS"), await buildSha256Sums(directory, tag));
    const result = await verifyReleaseDirectory(directory, tag);
    assert.equal(result.verifiedDigests, 8);

    await writeFile(join(directory, "pocket-tools-v0.1.0-x86.apk"), "mutated");
    await assert.rejects(() => verifyReleaseDirectory(directory, tag), /RELEASE_CHECKSUM_MISMATCH/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("rejects missing and extra staged assets", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pocket-tools-release-contract-"));
  try {
    await writeFile(join(directory, "unexpected.txt"), "nope");
    await assert.rejects(() => buildSha256Sums(directory, "v0.1.0"), /RELEASE_ASSET_SET_INVALID/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
