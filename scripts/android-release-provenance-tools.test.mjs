import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  bindSignedInspectionProvenance,
  loadUnsignedSigningProvenance,
  validateStagingInspectionProvenance,
} from "./android-release-provenance-tools.mjs";
import { RELEASE_ABIS, sha256 } from "./release-contract.mjs";

const SOURCE_COMMIT = "a".repeat(40);
const TAG = "v0.1.0";

async function createUnsignedFixture(abi = "arm64-v8a") {
  const root = await mkdtemp(join(tmpdir(), "pocket-tools-provenance-"));
  const apk = join(root, `pocket-tools-${TAG}-${abi}-unsigned.apk`);
  const bytes = Buffer.from(`unsigned-${abi}`);
  await writeFile(apk, bytes);
  const inspection = `${apk}.inspection.json`;
  await writeFile(
    inspection,
    JSON.stringify({
      abi,
      byteSize: bytes.byteLength,
      filename: apk.split(/[\\/]/).at(-1),
      handoff: "unsigned-intermediate",
      sha256: sha256(bytes),
      signed: false,
      sourceCommit: SOURCE_COMMIT,
      tag: TAG,
    }),
    "utf8",
  );
  return { root, apk, inspection };
}

test("loads provenance only when unsigned bytes and source identity agree", async () => {
  const fixture = await createUnsignedFixture();
  try {
    assert.deepEqual(
      await loadUnsignedSigningProvenance({
        apkPath: fixture.apk,
        inspectionPath: fixture.inspection,
        expectedSourceCommit: SOURCE_COMMIT,
        expectedTag: TAG,
        expectedAbi: "arm64-v8a",
      }),
      {
        abi: "arm64-v8a",
        sourceCommit: SOURCE_COMMIT,
        tag: TAG,
      },
    );
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("rejects source-commit drift before signing", async () => {
  const fixture = await createUnsignedFixture();
  try {
    await assert.rejects(
      () =>
        loadUnsignedSigningProvenance({
          apkPath: fixture.apk,
          inspectionPath: fixture.inspection,
          expectedSourceCommit: "b".repeat(40),
        }),
      /ANDROID_PROVENANCE_MISMATCH: sourceCommit/,
    );
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("rejects unsigned APK mutation before signing", async () => {
  const fixture = await createUnsignedFixture();
  try {
    await writeFile(fixture.apk, "mutated", "utf8");
    await assert.rejects(
      () =>
        loadUnsignedSigningProvenance({
          apkPath: fixture.apk,
          inspectionPath: fixture.inspection,
          expectedSourceCommit: SOURCE_COMMIT,
        }),
      /ANDROID_PROVENANCE_MISMATCH: byteSize|ANDROID_PROVENANCE_MISMATCH: sha256/,
    );
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("binds the signed inspection to the validated source identity", () => {
  assert.deepEqual(
    bindSignedInspectionProvenance(
      { abi: "arm64-v8a", filename: "pocket-tools-v0.1.0-arm64-v8a.apk" },
      { abi: "arm64-v8a", sourceCommit: SOURCE_COMMIT, tag: TAG },
    ),
    {
      abi: "arm64-v8a",
      filename: "pocket-tools-v0.1.0-arm64-v8a.apk",
      sourceCommit: SOURCE_COMMIT,
      tag: TAG,
    },
  );
});

test("staging rejects signed inspections from another source commit", async () => {
  const root = await mkdtemp(join(tmpdir(), "pocket-tools-stage-provenance-"));
  try {
    await mkdir(root, { recursive: true });
    for (const abi of RELEASE_ABIS) {
      await writeFile(
        join(root, `pocket-tools-${TAG}-${abi}.apk.inspection.json`),
        JSON.stringify({
          abi,
          sourceCommit: abi === "x86" ? "b".repeat(40) : SOURCE_COMMIT,
          tag: TAG,
        }),
        "utf8",
      );
    }
    await assert.rejects(
      () =>
        validateStagingInspectionProvenance({
          identity: { sourceCommit: SOURCE_COMMIT, tag: TAG },
          inputDirectory: root,
        }),
      /ANDROID_PROVENANCE_MISMATCH: sourceCommit/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
