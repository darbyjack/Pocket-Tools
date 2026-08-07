import assert from "node:assert/strict";
import test from "node:test";

import {
  assertGitleaksSelfTestResult,
  classifySuspiciousPaths,
  collectLargeBlobs,
  parseArguments,
} from "./repository-history-audit.mjs";

test("classifies environment and signing paths", () => {
  const findings = classifySuspiciousPaths([
    {
      object: "a".repeat(40),
      size: 123,
      paths: ["config/.env.production", "release/signing-key.p12", "src/app.ts"],
    },
  ]);

  assert.deepEqual(
    findings.map(({ path, categories }) => ({ path, categories })),
    [
      { path: "config/.env.production", categories: ["environment"] },
      { path: "release/signing-key.p12", categories: ["private-key"] },
    ],
  );
});

test("classifies generated native projects and package artifacts", () => {
  const findings = classifySuspiciousPaths([
    {
      object: "b".repeat(40),
      size: 456,
      paths: [
        "apps/mobile/android/app/build.gradle",
        "apps/mobile/ios/Podfile.lock",
        "release/pocket-tools.apk",
      ],
    },
  ]);

  assert.deepEqual(
    findings.map(({ path, categories }) => ({ path, categories })),
    [
      {
        path: "apps/mobile/android/app/build.gradle",
        categories: ["generated-android"],
      },
      { path: "apps/mobile/ios/Podfile.lock", categories: ["generated-ios"] },
      { path: "release/pocket-tools.apk", categories: ["package"] },
    ],
  );
});

test("large blobs are thresholded and sorted largest first", () => {
  assert.deepEqual(
    collectLargeBlobs(
      [
        { object: "small", size: 99, paths: ["small.txt"] },
        { object: "large", size: 200, paths: ["large.bin"] },
        { object: "medium", size: 150, paths: ["medium.bin"] },
      ],
      100,
    ),
    [
      { object: "large", size: 200, paths: ["large.bin"] },
      { object: "medium", size: 150, paths: ["medium.bin"] },
    ],
  );
});

test("accepts a Gitleaks self-test only when the synthetic token is detected", () => {
  assert.doesNotThrow(() => assertGitleaksSelfTestResult({ status: 1 }));
  assert.throws(
    () => assertGitleaksSelfTestResult({ status: 0 }),
    /failed to detect the synthetic GitHub token/,
  );
  assert.throws(
    () => assertGitleaksSelfTestResult({ status: 2, stderr: "scanner error" }),
    /self-test exited with 2/,
  );
});

test("audit arguments accept explicit thresholds and tools", () => {
  const options = parseArguments([
    "--output",
    "release-work/custom-audit",
    "--gitleaks",
    "C:\\tools\\gitleaks.exe",
    "--large-blob-bytes",
    "2048",
    "--content-scan-bytes",
    "4096",
  ]);

  assert.equal(options.gitleaks, "C:\\tools\\gitleaks.exe");
  assert.equal(options.largeBlobBytes, 2048);
  assert.equal(options.contentScanBytes, 4096);
  assert.match(options.output, /release-work[\\/]+custom-audit$/);
});

test("audit arguments reject invalid thresholds", () => {
  assert.throws(
    () => parseArguments(["--large-blob-bytes", "0"]),
    /largeBlobBytes must be a positive integer/,
  );
});
