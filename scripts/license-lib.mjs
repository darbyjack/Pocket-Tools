import { createHash } from "node:crypto";

const SPDX_EXPRESSION_CHARACTERS = /^[A-Za-z0-9.+()\-\s]+$/;
const SPDX_OPERATORS = new Set(["AND", "OR", "WITH"]);

export function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function normalizePnpmLicenseReport(raw, policy, overrides) {
  const candidates = [];

  if (Array.isArray(raw)) {
    for (const entry of raw) {
      const declared = entry.license ?? entry.licenses;
      addPnpmCandidate(candidates, declared, entry);
    }
  } else if (raw !== null && typeof raw === "object") {
    for (const [declared, packages] of Object.entries(raw)) {
      if (!Array.isArray(packages)) {
        throw new Error(`LICENSE_INVENTORY_INVALID: pnpm license group ${declared} is not an array.`);
      }
      for (const entry of packages) addPnpmCandidate(candidates, declared, entry);
    }
  } else {
    throw new Error("LICENSE_INVENTORY_INVALID: pnpm did not return an object or array.");
  }

  return buildInventory("npm", "pnpm-lock.yaml", candidates, policy, overrides);
}

export function normalizeAndroidLicenseReport(raw, policy, overrides) {
  if (!Array.isArray(raw)) {
    throw new Error("LICENSE_INVENTORY_INVALID: Android inventory must be an array.");
  }

  const candidates = raw.map((entry) => {
    const group = requireText(entry.group, "android.group");
    const module = requireText(entry.module, "android.module");
    const version = requireText(entry.version, "android.version");
    const licenseNames = Array.isArray(entry.licenseNames)
      ? entry.licenseNames.map((value, index) => requireText(value, `android.licenseNames[${index}]`))
      : [];
    const licenseUrls = Array.isArray(entry.licenseUrls)
      ? entry.licenseUrls.map(String).filter(Boolean).sort()
      : [];
    const licenseSource =
      entry.licenseSource === undefined || entry.licenseSource === null
        ? undefined
        : requireText(String(entry.licenseSource), "android.licenseSource");
    const licenseInheritanceChain = Array.isArray(entry.licenseInheritanceChain)
      ? entry.licenseInheritanceChain.map((value, index) =>
          requireText(String(value), `android.licenseInheritanceChain[${index}]`),
        )
      : [];
    const declaredLicense =
      licenseNames.length === 1 ? licenseNames[0] : licenseNames.length === 0 ? "UNKNOWN" : "LicenseRef-MULTIPLE";

    return {
      name: `${group}:${module}`,
      version,
      declaredLicense,
      purl: `pkg:maven/${encodeURIComponent(group)}/${encodeURIComponent(module)}@${encodeURIComponent(version)}`,
      metadata: {
        group,
        module,
        licenseNames: [...licenseNames].sort(),
        licenseUrls,
        ...(licenseSource === undefined ? {} : { licenseSource }),
        ...(licenseInheritanceChain.length === 0 ? {} : { licenseInheritanceChain }),
      },
    };
  });

  return buildInventory("maven", "releaseRuntimeClasspath", candidates, policy, overrides);
}

export function validateInventory(inventory, policy) {
  if (inventory?.schemaVersion !== 1) {
    throw new Error("LICENSE_INVENTORY_INVALID: inventory schemaVersion must be 1.");
  }
  if (!Array.isArray(inventory.packages)) {
    throw new Error("LICENSE_INVENTORY_INVALID: inventory packages must be an array.");
  }

  const keys = new Set();
  for (const entry of inventory.packages) {
    const name = requireText(entry.name, "package.name");
    const version = requireText(entry.version, `${name}.version`);
    const key = `${name}@${version}`;
    if (keys.has(key)) throw new Error(`LICENSE_INVENTORY_INVALID: duplicate package ${key}.`);
    keys.add(key);

    validateLicenseExpression(requireText(entry.declaredLicense, `${key}.declaredLicense`), policy, key);
    validateLicenseExpression(requireText(entry.concludedLicense, `${key}.concludedLicense`), policy, key);
    requireText(entry.purl, `${key}.purl`);
  }

  const sorted = [...inventory.packages].sort(comparePackages);
  if (stableJson(sorted) !== stableJson(inventory.packages)) {
    throw new Error("LICENSE_INVENTORY_INVALID: packages are not in deterministic order.");
  }
  return inventory;
}

export function buildSpdxDocument({ rootVersion, npmInventory, androidInventory, created }) {
  const version = requireText(rootVersion, "rootVersion");
  const createdAt = normalizeCreated(created);
  const dependencies = [...npmInventory.packages, ...androidInventory.packages].sort((left, right) =>
    `${left.ecosystem}:${left.name}@${left.version}`.localeCompare(
      `${right.ecosystem}:${right.name}@${right.version}`,
    ),
  );
  const contentHash = createHash("sha256")
    .update(stableJson({ version, npmInventory, androidInventory }))
    .digest("hex");
  const rootId = "SPDXRef-Pocket-Tools";
  const packages = [
    {
      SPDXID: rootId,
      name: "Pocket Tools",
      versionInfo: version,
      downloadLocation: "NOASSERTION",
      filesAnalyzed: false,
      licenseConcluded: "Apache-2.0",
      licenseDeclared: "Apache-2.0",
      copyrightText: "NOASSERTION",
    },
    ...dependencies.map((entry) => ({
      SPDXID: packageSpdxId(entry),
      name: entry.name,
      versionInfo: entry.version,
      downloadLocation: "NOASSERTION",
      filesAnalyzed: false,
      licenseConcluded: entry.concludedLicense,
      licenseDeclared: entry.declaredLicense,
      copyrightText: "NOASSERTION",
      externalRefs: [
        {
          referenceCategory: "PACKAGE-MANAGER",
          referenceType: "purl",
          referenceLocator: entry.purl,
        },
      ],
    })),
  ];
  const relationships = dependencies.map((entry) => ({
    spdxElementId: rootId,
    relationshipType: "DEPENDS_ON",
    relatedSpdxElement: packageSpdxId(entry),
  }));

  return {
    spdxVersion: "SPDX-2.3",
    dataLicense: "CC0-1.0",
    SPDXID: "SPDXRef-DOCUMENT",
    name: `Pocket Tools ${version}`,
    documentNamespace: `https://github.com/darbyjack/Pocket-Tools/sbom/${version}/${contentHash}`,
    creationInfo: {
      created: createdAt,
      creators: ["Tool: Pocket Tools deterministic license tooling"],
    },
    documentDescribes: [rootId],
    packages,
    relationships,
  };
}

export function validateSpdxDocument(document) {
  if (document?.spdxVersion !== "SPDX-2.3") {
    throw new Error("SBOM_INVALID: spdxVersion must be SPDX-2.3.");
  }
  if (document.dataLicense !== "CC0-1.0" || document.SPDXID !== "SPDXRef-DOCUMENT") {
    throw new Error("SBOM_INVALID: document identity fields are invalid.");
  }
  requireText(document.name, "sbom.name");
  requireText(document.documentNamespace, "sbom.documentNamespace");
  normalizeCreated(document.creationInfo?.created);
  if (!Array.isArray(document.creationInfo?.creators) || document.creationInfo.creators.length === 0) {
    throw new Error("SBOM_INVALID: at least one creator is required.");
  }
  if (!Array.isArray(document.packages) || document.packages.length === 0) {
    throw new Error("SBOM_INVALID: at least one package is required.");
  }
  const ids = new Set();
  for (const entry of document.packages) {
    const id = requireText(entry.SPDXID, "sbom.package.SPDXID");
    if (ids.has(id)) throw new Error(`SBOM_INVALID: duplicate package identifier ${id}.`);
    ids.add(id);
    requireText(entry.name, `${id}.name`);
    requireText(entry.downloadLocation, `${id}.downloadLocation`);
    requireText(entry.licenseDeclared, `${id}.licenseDeclared`);
    requireText(entry.licenseConcluded, `${id}.licenseConcluded`);
  }
  return document;
}

export function normalizeLicenseName(value, policy) {
  const name = requireText(String(value), "license");
  return policy.aliases?.[name] ?? name;
}

export function validateLicenseExpression(expression, policy, packageKey = "package") {
  const normalized = normalizeLicenseName(expression, policy);
  assertNoForbiddenLicense(normalized, policy, packageKey);
  for (const pattern of policy.reviewRequiredPatterns ?? []) {
    if (normalized.toUpperCase().includes(String(pattern).toUpperCase())) {
      throw new Error(`LICENSE_REVIEW_REQUIRED: ${packageKey} declares ${normalized}.`);
    }
  }
  if (!SPDX_EXPRESSION_CHARACTERS.test(normalized)) {
    throw new Error(`LICENSE_UNKNOWN: ${packageKey} has non-SPDX expression ${normalized}.`);
  }

  const identifiers = normalized
    .replace(/[()]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => !SPDX_OPERATORS.has(token));
  const allowed = new Set(policy.allowedLicenseIds ?? []);
  if (identifiers.length === 0 || identifiers.some((identifier) => !allowed.has(identifier))) {
    throw new Error(`LICENSE_UNKNOWN: ${packageKey} declares unapproved expression ${normalized}.`);
  }
  return normalized;
}

function addPnpmCandidate(candidates, declaredLicense, entry) {
  if (entry === null || typeof entry !== "object") {
    throw new Error("LICENSE_INVENTORY_INVALID: pnpm package entry must be an object.");
  }
  const name = requireText(entry.name, "pnpm.name");
  const versions = Array.isArray(entry.versions)
    ? entry.versions
    : entry.version === undefined
      ? []
      : [entry.version];
  if (versions.length === 0) {
    throw new Error(`LICENSE_INVENTORY_INVALID: ${name} has no version.`);
  }

  for (const versionValue of versions) {
    const version = requireText(String(versionValue), `${name}.version`);
    candidates.push({
      name,
      version,
      declaredLicense: String(declaredLicense ?? "UNKNOWN"),
      purl: npmPurl(name, version),
      metadata: {},
    });
  }
}

function buildInventory(ecosystem, source, candidates, policy, overrides) {
  const packages = [];
  const seen = new Set();
  for (const candidate of candidates) {
    const key = `${ecosystem}:${candidate.name}@${candidate.version}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const override = overrides.packages?.[key];
    if (override !== undefined) {
      requireText(override.reason, `${key}.override.reason`);
    }
    const declaredLicense = normalizeLicenseName(
      override?.declaredLicense ?? candidate.declaredLicense,
      policy,
    );
    const concludedLicense = normalizeLicenseName(
      override?.concludedLicense ?? declaredLicense,
      policy,
    );
    assertOverrideDoesNotBypassForbiddenLicense(
      candidate.declaredLicense,
      declaredLicense,
      concludedLicense,
      override,
      policy,
      key,
    );
    validateLicenseExpression(declaredLicense, policy, key);
    validateLicenseExpression(concludedLicense, policy, key);

    packages.push({
      ecosystem,
      name: candidate.name,
      version: candidate.version,
      declaredLicense,
      concludedLicense,
      purl: candidate.purl,
      ...(override === undefined
        ? {}
        : {
            review: {
              reason: override.reason,
              ...(override.notice === undefined ? {} : { notice: requireText(override.notice, `${key}.notice`) }),
            },
          }),
      ...(Object.keys(candidate.metadata).length === 0 ? {} : { metadata: candidate.metadata }),
    });
  }

  const inventory = {
    schemaVersion: 1,
    ecosystem,
    source,
    packages: packages.sort(comparePackages),
  };
  return validateInventory(inventory, policy);
}

function assertOverrideDoesNotBypassForbiddenLicense(
  candidateDeclaredLicense,
  declaredLicense,
  concludedLicense,
  override,
  policy,
  packageKey,
) {
  const candidate = normalizeLicenseName(candidateDeclaredLicense, policy);
  if (findForbiddenPattern(candidate, policy) === undefined) return;

  const alternatives = splitOrAlternatives(candidate, policy);
  const selected = [declaredLicense, concludedLicense];
  if (
    override !== undefined &&
    alternatives.length > 1 &&
    selected.every(
      (license) =>
        alternatives.includes(license) && findForbiddenPattern(license, policy) === undefined,
    )
  ) {
    return;
  }

  assertNoForbiddenLicense(candidate, policy, packageKey);
}

function splitOrAlternatives(expression, policy) {
  const unwrapped = stripWrappingParentheses(expression.trim());
  if (/\b(?:AND|WITH)\b/.test(unwrapped) || /[()]/.test(unwrapped)) return [];

  const alternatives = unwrapped.split(/\s+OR\s+/);
  if (alternatives.length < 2) return [];
  return alternatives.map((alternative) => normalizeLicenseName(alternative, policy));
}

function stripWrappingParentheses(expression) {
  let unwrapped = expression;
  while (isWrappedByParentheses(unwrapped)) {
    unwrapped = unwrapped.slice(1, -1).trim();
  }
  return unwrapped;
}

function isWrappedByParentheses(expression) {
  if (!expression.startsWith("(") || !expression.endsWith(")")) return false;

  let depth = 0;
  for (let index = 0; index < expression.length; index += 1) {
    if (expression[index] === "(") depth += 1;
    if (expression[index] === ")") depth -= 1;
    if (depth < 0 || (depth === 0 && index < expression.length - 1)) return false;
  }
  return depth === 0;
}

function assertNoForbiddenLicense(expression, policy, packageKey) {
  const pattern = findForbiddenPattern(expression, policy);
  if (pattern !== undefined) {
    throw new Error(`LICENSE_FORBIDDEN: ${packageKey} declares ${expression}.`);
  }
}

function findForbiddenPattern(expression, policy) {
  const upper = expression.toUpperCase();
  return (policy.forbiddenPatterns ?? []).find((pattern) =>
    upper.includes(String(pattern).toUpperCase()),
  );
}

function npmPurl(name, version) {
  if (name.startsWith("@")) {
    const [scope, packageName] = name.split("/");
    if (!scope || !packageName) throw new Error(`LICENSE_INVENTORY_INVALID: invalid npm package ${name}.`);
    return `pkg:npm/${encodeURIComponent(scope)}/${encodeURIComponent(packageName)}@${encodeURIComponent(version)}`;
  }
  return `pkg:npm/${encodeURIComponent(name)}@${encodeURIComponent(version)}`;
}

function packageSpdxId(entry) {
  const digest = createHash("sha256")
    .update(`${entry.ecosystem}:${entry.name}@${entry.version}`)
    .digest("hex")
    .slice(0, 12);
  const label = `${entry.ecosystem}-${entry.name}-${entry.version}`.replace(/[^A-Za-z0-9.-]+/g, "-");
  return `SPDXRef-${label}-${digest}`;
}

function comparePackages(left, right) {
  return `${left.ecosystem}:${left.name}@${left.version}`.localeCompare(
    `${right.ecosystem}:${right.name}@${right.version}`,
  );
}

function normalizeCreated(value) {
  const created = requireText(value, "created");
  const timestamp = Date.parse(created);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== created) {
    throw new Error("SBOM_INVALID: created must be a canonical UTC millisecond timestamp.");
  }
  return created;
}

function requireText(value, path) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`LICENSE_INVENTORY_INVALID: ${path} must be non-empty text.`);
  }
  return value.trim();
}
