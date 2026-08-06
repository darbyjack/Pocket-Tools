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
  allowedLicenseIds: [
    "Apache-2.0",
    "BlueOak-1.0.0",
    "BSD-3-Clause",
    "CC-BY-4.0",
    "ISC",
    "MIT",
    "MPL-2.0",
  ],
  aliases: {
    "APACHE-2.": "Apache-2.0",
    "Apache-2.": "Apache-2.0",
    "Apache License 2.0": "Apache-2.0",
    "The Apache Software License, Version 2.0": "Apache-2.0",
    "Blue Oak Model License 1.0.0": "BlueOak-1.0.0",
    "MIT License": "MIT",
    "MIT license.": "MIT",
    "The MIT License": "MIT",
    "Mozilla Public License Version 2.0": "MPL-2.0",
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
  assert.throws(() => validateLicenseExpression("CC-BY-3.0", policy), /LICENSE_UNKNOWN/);
  assert.equal(validateLicenseExpression("CC-BY-4.0", policy), "CC-BY-4.0");
  assert.equal(validateLicenseExpression("BlueOak-1.0.0", policy), "BlueOak-1.0.0");
  assert.equal(validateLicenseExpression("Blue Oak Model License 1.0.0", policy), "BlueOak-1.0.0");
  assert.equal(validateLicenseExpression("MPL-2.0", policy), "MPL-2.0");
  assert.equal(validateLicenseExpression("Mozilla Public License Version 2.0", policy), "MPL-2.0");
  assert.equal(
    validateLicenseExpression("The Apache Software License, Version 2.0", policy),
    "Apache-2.0",
  );
  assert.equal(validateLicenseExpression("APACHE-2.", policy), "Apache-2.0");
  assert.equal(validateLicenseExpression("Apache-2.", policy), "Apache-2.0");
  assert.equal(validateLicenseExpression("MIT license.", policy), "MIT");
  assert.equal(validateLicenseExpression("The MIT License", policy), "MIT");
  assert.equal(validateLicenseExpression("MIT OR Apache-2.0", policy), "MIT OR Apache-2.0");
});

test("uses the reviewed BSD option for a dual-licensed npm package", () => {
  const inventory = normalizePnpmLicenseReport(
    {
      "(BSD-3-Clause OR GPL-2.0)": [{ name: "node-forge", versions: ["1.4.0"] }],
    },
    policy,
    {
      schemaVersion: 1,
      packages: {
        "npm:node-forge@1.4.0": {
          declaredLicense: "BSD-3-Clause",
          concludedLicense: "BSD-3-Clause",
          reason: "Reviewed upstream dual-license grant and selected BSD-3-Clause.",
        },
      },
    },
  );

  assert.equal(inventory.packages[0].declaredLicense, "BSD-3-Clause");
  assert.equal(inventory.packages[0].concludedLicense, "BSD-3-Clause");
});

test("does not allow an override to hide a forbidden single-license declaration", () => {
  assert.throws(
    () =>
      normalizePnpmLicenseReport(
        { "GPL-3.0-only": [{ name: "blocked", versions: ["1.0.0"] }] },
        policy,
        {
          schemaVersion: 1,
          packages: {
            "npm:blocked@1.0.0": {
              declaredLicense: "MIT",
              concludedLicense: "MIT",
              reason: "Invalid attempt to replace a forbidden license.",
            },
          },
        },
      ),
    /LICENSE_FORBIDDEN/,
  );
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

test("requires an exact reviewed override when Maven metadata has no license", () => {
  const raw = [
    {
      group: "example",
      module: "missing-license",
      version: "1.0.0",
      licenseNames: [],
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
      "maven:example:missing-license@1.0.0": {
        declaredLicense: "BSD-3-Clause",
        concludedLicense: "BSD-3-Clause",
        reason: "Reviewed the exact upstream release license.",
      },
    },
  });
  assert.equal(reviewed.packages[0].declaredLicense, "BSD-3-Clause");
  assert.match(reviewed.packages[0].review.reason, /exact upstream release/);
});

test("uses an exact reviewed override for an ambiguous generic BSD Maven label", () => {
  const raw = [
    {
      group: "com.parse.bolts",
      module: "bolts-tasks",
      version: "1.4.0",
      licenseNames: ["BSD License."],
      licenseUrls: [],
    },
  ];

  assert.throws(() => normalizeAndroidLicenseReport(raw, policy, overrides), /LICENSE_UNKNOWN/);

  const reviewed = normalizeAndroidLicenseReport(raw, policy, {
    schemaVersion: 1,
    packages: {
      "maven:com.parse.bolts:bolts-tasks@1.4.0": {
        declaredLicense: "BSD-3-Clause",
        concludedLicense: "BSD-3-Clause",
        reason: "Reviewed the exact 1.4.0 source tag and three-clause BSD text.",
      },
    },
  });
  assert.equal(reviewed.packages[0].concludedLicense, "BSD-3-Clause");
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
