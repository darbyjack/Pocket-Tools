import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { RELEASE_ABIS, sha256, stableJson } from "./release-contract.mjs";
import { expectedUnsignedHandoffNames, validateUnsignedHandoff } from "./ci-release-collect.mjs";

const TAG = "v0.1.0";
const SOURCE = "0123456789abcdef0123456789abcdef01234567";

test("validates the exact four-ABI unsigned artifact handoff", async () => {
  await withHandoff(async (directory) => {
    const result = await validateUnsignedHandoff({
      directory,
      sourceCommit: SOURCE,
      tag: TAG,
    });

    assert.deepEqual(result.files, expectedUnsignedHandoffNames(TAG).sort(bytewiseCompare));
    assert.deepEqual(
      result.verified.map((entry) => entry.abi),
      RELEASE_ABIS,
    );
  });
});

test("rejects extra files before signing secrets are available", async () => {
  await withHandoff(async (directory) => {
    await writeFile(join(directory, "unexpected.txt"), "nope", "utf8");
    await assert.rejects(
      validateUnsignedHandoff({ directory, sourceCommit: SOURCE, tag: TAG }),
      /CI_RELEASE_INPUT_SET_INVALID/u,
    );
  });
});

test("rejects source provenance drift", async () => {
  await withHandoff(async (directory) => {
    await assert.rejects(
      validateUnsignedHandoff({
        directory,
        sourceCommit: "fedcba9876543210fedcba9876543210fedcba98",
        tag: TAG,
      }),
      /ANDROID_PROVENANCE_MISMATCH/u,
    );
  });
});

async function withHandoff(callback) {
  const directory = await mkdtemp(join(tmpdir(), "pocket-tools-ci-release-"));
  try {
    for (const abi of RELEASE_ABIS) {
      const filename = `pocket-tools-${TAG}-${abi}-unsigned.apk`;
      const bytes = Buffer.from(`unsigned-${abi}`);
      await writeFile(join(directory, filename), bytes);
      await writeFile(
        join(directory, `${filename}.inspection.json`),
        stableJson({
          abi,
          byteSize: bytes.byteLength,
          filename,
          handoff: "unsigned-intermediate",
          sha256: sha256(bytes),
          signed: false,
          sourceCommit: SOURCE,
          tag: TAG,
        }),
        "utf8",
      );
    }
    await callback(directory);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
}

function bytewiseCompare(left, right) {
  return Buffer.from(left).compare(Buffer.from(right));
}
