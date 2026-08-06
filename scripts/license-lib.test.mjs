import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSpdxDocument,
  normalizeAndroidLicenseReport,
  normalizePnpmLicenseReport,
  stableJson,
  validateLicenseExpression,
  validateSpdxDocument,
} from "./license-lib.mjs";

const policy = {
  schemaVersion: 1,
  allowedLicenseIds: ["Apache-2.0", "BSD-3-Clause", "ISC", "MIT"],
  aliases: {
    "Apache License 2.0": "Apache-2.0",
    "MIT License": "MIT",
  },
  forbiddenPatterns: ["AGPL", "GPL"],
  reviewRequiredPatterns: ["LicenseRef-", "UNKNOWN", "UNLICENSED"],
};
const overrides = { schemaVersion: 1, packages: {} };

test("normalizes and deterministically sorts pnpm license groups", () => {
  const inventory = normalizePnpmLicenseReport(
    {
      MIT: [
        { name: "zeta", versions: ["2.0.0"] },
        { name: "alpha", versions: ["1.0.0"] },
      ],
      "Apache License 2.0": [{ name: "middle", versions: ["3.0.0"] }],
    },
    policy,
    overrides,
  );

  assert.deepEqual(
    inventory.packages.map((entry) => `${entry.name}@${entry.version}:${entry.declaredLicense}`),
    ["alpha@1.0.0:MIT", "middle@3.0.0:Apache-2.0", "zeta@2.0.0:MIT"],
  );
});

test("fails closed on forbidden, unknown, and review-required licenses", () => {
  assert.throws(() => validateLicenseExpression("GPL-3.0-only", policy), /LICENSE_FORBIDDEN/);
  assert.throws(() => validateLicenseExpression("Custom", policy), /LICENSE_UNKNOWN/);
  assert.throws(() => validateLicenseExpression("UNKNOWN", policy), /LICENSE_REVIEW_REQUIRED/);
  assert.equal(validateLicenseExpression("MIT OR Apache-2.0", policy), "MIT OR Apache-2.0");
});

test("requires an explicit reviewed override for ambiguous Maven POM licenses", () => {
  const raw = [
    {
      group: "example",
      module: "ambiguous",
      version: "1.0.0",
      licenseNames: ["MIT", "BSD 3-Clause"],
      licenseUrls: [],
    },
  ];

  assert.throws(
    () => normalizeAndroidLicenseReport(raw, policy, overrides),
    /LICENSE_REVIEW_REQUIRED/,
  );

  const reviewed = normalizeAndroidLicenseReport(raw, policy, {
    schemaVersion: 1,
    packages: {
      "maven:example:ambiguous@1.0.0": {
        declaredLicense: "MIT OR BSD-3-Clause",
        concludedLicense: "MIT OR BSD-3-Clause",
        reason: "Reviewed upstream dual-license declaration.",
      },
    },
  });
  assert.equal(reviewed.packages[0].concludedLicense, "MIT OR BSD-3-Clause");
});

test("produces deterministic SPDX 2.3 JSON", () => {
  const npmInventory = normalizePnpmLicenseReport(
    { MIT: [{ name: "example", versions: ["1.0.0"] }] },
    policy,
    overrides,
  );
  const androidInventory = normalizeAndroidLicenseReport(
    [
      {
        group: "androidx.example",
        module: "example",
        version: "2.0.0",
        licenseNames: ["Apache License 2.0"],
        licenseUrls: [],
      },
    ],
    policy,
    overrides,
  );
  const input = {
    rootVersion: "0.1.0",
    npmInventory,
    androidInventory,
    created: "1970-01-01T00:00:00.000Z",
  };

  const first = validateSpdxDocument(buildSpdxDocument(input));
  const second = validateSpdxDocument(buildSpdxDocument(input));
  assert.equal(stableJson(first), stableJson(second));
  assert.equal(first.spdxVersion, "SPDX-2.3");
  assert.equal(first.packages.length, 3);
});
