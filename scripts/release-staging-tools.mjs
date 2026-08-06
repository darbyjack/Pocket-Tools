import { X509Certificate } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import {
  copyFile,
  lstat,
  mkdir,
  readFile,
  readdir,
  stat,
  writeFile,
} from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";

import { REQUIRED_NATIVE_LIBRARIES, normalizeFingerprint } from "./android-release-tools.mjs";
import {
  RELEASE_ABIS,
  RELEASE_SDK_LEVELS,
  buildSha256Sums,
  expectedReleaseAssetNames,
  parseReleaseTag,
  sha256,
  stableJson,
  verifyReleaseDirectory,
} from "./release-contract.mjs";

export const RELEASE_CERTIFICATE_FILENAME = "pocket-tools-release-certificate.pem";

export function finalApkFilename(tag, abi) {
  validateAbi(abi);
  return `pocket-tools-${parseReleaseTag(tag).tag}-${abi}.apk`;
}

export function signedInspectionFilename(tag, abi) {
  return `${finalApkFilename(tag, abi)}.inspection.json`;
}

export function expectedReleaseInputNames(tag) {
  return [
    ...RELEASE_ABIS.flatMap((abi) => [
      finalApkFilename(tag, abi),
      signedInspectionFilename(tag, abi),
    ]),
    RELEASE_CERTIFICATE_FILENAME,
  ];
}

export function certificateMetadata(pem) {
  let certificate;
  try {
    certificate = new X509Certificate(pem);
  } catch (cause) {
    throw new Error("RELEASE_CERTIFICATE_INVALID: unable to parse the public certificate PEM.", {
      cause,
    });
  }
  return {
    filename: RELEASE_CERTIFICATE_FILENAME,
    pemSubject: normalizeDistinguishedName(certificate.subject),
    sha256: normalizeFingerprint(certificate.fingerprint256),
  };
}

export function buildFinalReleaseMetadata({
  identity,
  inspections,
  certificate,
  spdx,
  notices,
  toolchain,
}) {
  const inspectionByAbi = new Map(inspections.map((inspection) => [inspection.abi, inspection]));
  if (inspectionByAbi.size !== RELEASE_ABIS.length) {
    throw new Error("RELEASE_METADATA_INVALID: exactly one signed inspection is required per ABI.");
  }

  const signerFingerprints = new Set();
  const signerSubjects = new Set();
  const buildToolsVersions = new Set();
  const apks = [];
  for (const abi of RELEASE_ABIS) {
    const inspection = inspectionByAbi.get(abi);
    if (!inspection) {
      throw new Error(`RELEASE_METADATA_INVALID: signed inspection for ${abi} is missing.`);
    }
    validateSignedInspection(inspection, identity, abi);
    signerFingerprints.add(inspection.signer.sha256);
    signerSubjects.add(inspection.signer.subject);
    buildToolsVersions.add(inspection.buildToolsVersion);
    apks.push({
      abi,
      aligned: true,
      byteSize: inspection.byteSize,
      filename: inspection.filename,
      nativeLibraries: inspection.nativeLibraries,
      sha256: inspection.sha256,
    });
  }

  if (signerFingerprints.size !== 1 || signerSubjects.size !== 1) {
    throw new Error("RELEASE_METADATA_INVALID: every APK must use the same signing identity.");
  }
  if (buildToolsVersions.size !== 1) {
    throw new Error("RELEASE_METADATA_INVALID: every APK must use the same Android Build Tools version.");
  }

  const signerFingerprint = [...signerFingerprints][0];
  if (signerFingerprint !== certificate.sha256) {
    throw new Error(
      `RELEASE_CERTIFICATE_MISMATCH: APK signer ${signerFingerprint} does not match certificate ${certificate.sha256}.`,
    );
  }
  const androidBuildTools = [...buildToolsVersions][0];

  return {
    schema: identity.schema,
    schemaVersion: identity.schemaVersion,
    tag: identity.tag,
    version: identity.version,
    versionCode: identity.versionCode,
    packageName: identity.packageName,
    sourceCommit: identity.sourceCommit,
    classification: identity.classification,
    prerelease: identity.prerelease,
    sdk: identity.sdk,
    abis: [...identity.abis],
    releaseAssets: expectedReleaseAssetNames(identity.tag),
    apks,
    signingCertificate: {
      ...certificate,
      subject: [...signerSubjects][0],
    },
    legal: {
      notices,
      spdx,
    },
    toolchain: {
      ...toolchain,
      androidBuildTools,
    },
  };
}

export function renderDraftReleaseBody(metadata) {
  const rows = metadata.apks
    .map((apk) => `| \`${apk.abi}\` | \`${apk.filename}\` | \`${apk.sha256}\` |`)
    .join("\n");
  return `# Pocket Tools ${metadata.tag}

Pocket Tools ${metadata.version} (${metadata.classification}) built from commit \`${metadata.sourceCommit}\`.

## Android APKs

| ABI | Asset | SHA-256 |
| --- | --- | --- |
${rows}

Package: \`${metadata.packageName}\`  
Version code: \`${metadata.versionCode}\`  
SDK: minimum ${metadata.sdk.min}, compile ${metadata.sdk.compile}, target ${metadata.sdk.target}

## Signing identity

Certificate subject: \`${metadata.signingCertificate.subject}\`  
Certificate SHA-256: \`${metadata.signingCertificate.sha256}\`

Verify the APK, \`SHA256SUMS\`, release metadata, SPDX SBOM, notices, and public certificate from this same draft release before installation.

## Known limitations

> **Maintainer review required:** replace this block with known limitations, or state **None known** after review.

## Acceptance and publication

- Run the generated acceptance checklist against the exact downloaded draft assets.
- Do not rebuild, re-sign, rename, or replace an accepted asset.
- Publish this existing draft only after the final go/no-go decision is recorded.
`;
}

export function renderReleaseAcceptanceChecklist(metadata, canonicalChecklist) {
  const apkLines = metadata.apks
    .map((apk) => `- \`${apk.filename}\`: \`${apk.sha256}\``)
    .join("\n");
  return `# ${metadata.tag} Draft Release Acceptance Record

Generated identity for the exact staged assets:

- Tag: \`${metadata.tag}\`
- Version: \`${metadata.version}\`
- Version code: \`${metadata.versionCode}\`
- Package: \`${metadata.packageName}\`
- Source commit: \`${metadata.sourceCommit}\`
- Certificate SHA-256: \`${metadata.signingCertificate.sha256}\`

## APK digests

${apkLines}

---

${String(canonicalChecklist).trim()}\n`;
}

export async function stageReleaseArtifacts({
  identity,
  inputDirectory,
  outputDirectory,
  publicationDirectory,
  spdxPath,
  noticesPath,
  canonicalChecklistPath,
  toolchain,
}) {
  const input = resolve(inputDirectory);
  const output = resolve(outputDirectory);
  const publication = resolve(publicationDirectory);
  assertDisjointDirectories([input, output, publication]);
  await assertExactRegularFileSet(input, expectedReleaseInputNames(identity.tag));
  await assertDirectoryMissingOrEmpty(output, "release staging directory");
  await assertDirectoryMissingOrEmpty(publication, "release publication directory");

  const certificateBytes = await readFile(join(input, RELEASE_CERTIFICATE_FILENAME));
  const certificate = certificateMetadata(certificateBytes);
  const inspections = [];
  for (const abi of RELEASE_ABIS) {
    const apkFilename = finalApkFilename(identity.tag, abi);
    const apkPath = join(input, apkFilename);
    const apkBytes = await readFile(apkPath);
    const inspection = await readJson(join(input, signedInspectionFilename(identity.tag, abi)));
    validateSignedInspectionArtifact({ inspection, apkFilename, apkBytes, identity, abi });
    inspections.push(inspection);
  }

  const spdxBytes = await readFile(spdxPath);
  const spdxDocument = parseJson(spdxBytes, "SPDX SBOM");
  validateSpdxDocument(spdxDocument, identity.version);
  const noticesBytes = await readFile(noticesPath);
  validateNotices(noticesBytes);
  const canonicalChecklist = await readFile(canonicalChecklistPath, "utf8");

  const metadataFilename = `pocket-tools-${identity.tag}-release.json`;
  const spdxFilename = `pocket-tools-${identity.tag}.spdx.json`;
  const noticesFilename = `pocket-tools-${identity.tag}-third-party-notices.txt`;
  const metadata = buildFinalReleaseMetadata({
    identity,
    inspections,
    certificate,
    spdx: { filename: spdxFilename, sha256: sha256(spdxBytes) },
    notices: { filename: noticesFilename, sha256: sha256(noticesBytes) },
    toolchain,
  });

  await mkdir(output, { recursive: true });
  for (const abi of RELEASE_ABIS) {
    const filename = finalApkFilename(identity.tag, abi);
    await copyFile(join(input, filename), join(output, filename), fsConstants.COPYFILE_EXCL);
  }
  await copyFile(
    join(input, RELEASE_CERTIFICATE_FILENAME),
    join(output, RELEASE_CERTIFICATE_FILENAME),
    fsConstants.COPYFILE_EXCL,
  );
  await writeFile(join(output, spdxFilename), spdxBytes, { flag: "wx" });
  await writeFile(join(output, noticesFilename), noticesBytes, { flag: "wx" });
  await writeFile(join(output, metadataFilename), stableJson(metadata), {
    encoding: "utf8",
    flag: "wx",
  });
  await writeFile(
    join(output, "SHA256SUMS"),
    await buildSha256Sums(output, identity.tag),
    { encoding: "utf8", flag: "wx" },
  );
  const verification = await verifyReleaseDirectory(output, identity.tag);

  await mkdir(publication, { recursive: true });
  const releaseNotesFilename = `pocket-tools-${identity.tag}-release-notes.md`;
  const checklistFilename = `pocket-tools-${identity.tag}-acceptance-checklist.md`;
  await writeFile(join(publication, releaseNotesFilename), renderDraftReleaseBody(metadata), {
    encoding: "utf8",
    flag: "wx",
  });
  await writeFile(
    join(publication, checklistFilename),
    renderReleaseAcceptanceChecklist(metadata, canonicalChecklist),
    { encoding: "utf8", flag: "wx" },
  );

  return {
    tag: identity.tag,
    sourceCommit: identity.sourceCommit,
    stagingDirectory: output,
    publicationDirectory: publication,
    releaseAssets: verification.files,
    verifiedDigests: verification.verifiedDigests,
    publicationFiles: [releaseNotesFilename, checklistFilename],
  };
}

function validateSignedInspectionArtifact({ inspection, apkFilename, apkBytes, identity, abi }) {
  validateSignedInspection(inspection, identity, abi);
  compareField("filename", inspection.filename, apkFilename);
  compareField("byteSize", inspection.byteSize, apkBytes.byteLength);
  compareField("sha256", inspection.sha256, sha256(apkBytes));
}

function validateSignedInspection(inspection, identity, abi) {
  if (!inspection || typeof inspection !== "object" || Array.isArray(inspection)) {
    throw new Error(`RELEASE_INSPECTION_INVALID: ${abi} inspection must be an object.`);
  }
  compareField("abi", inspection.abi, abi);
  compareField("packageName", inspection.packageName, identity.packageName);
  compareField("versionName", inspection.versionName, identity.version);
  compareField("versionCode", inspection.versionCode, identity.versionCode);
  compareField("sdk", inspection.sdk, RELEASE_SDK_LEVELS);
  if (inspection.aligned !== true) {
    throw new Error(`RELEASE_INSPECTION_INVALID: ${abi} APK is not recorded as aligned.`);
  }
  if (!Number.isSafeInteger(inspection.byteSize) || inspection.byteSize <= 0) {
    throw new Error(`RELEASE_INSPECTION_INVALID: ${abi} byteSize is invalid.`);
  }
  if (!/^[0-9a-f]{64}$/.test(String(inspection.sha256))) {
    throw new Error(`RELEASE_INSPECTION_INVALID: ${abi} APK SHA-256 is invalid.`);
  }
  if (!Array.isArray(inspection.nativeLibraries)) {
    throw new Error(`RELEASE_INSPECTION_INVALID: ${abi} nativeLibraries must be an array.`);
  }
  for (const required of REQUIRED_NATIVE_LIBRARIES) {
    if (!inspection.nativeLibraries.includes(required)) {
      throw new Error(`RELEASE_INSPECTION_INVALID: ${abi} is missing ${required}.`);
    }
  }
  if (!inspection.signer || typeof inspection.signer !== "object") {
    throw new Error(`RELEASE_INSPECTION_INVALID: ${abi} signer metadata is missing.`);
  }
  const signerFingerprint = normalizeFingerprint(inspection.signer.sha256);
  if (signerFingerprint !== inspection.signer.sha256) {
    throw new Error(
      `RELEASE_INSPECTION_INVALID: ${abi} signer SHA-256 must be normalized lowercase hexadecimal.`,
    );
  }
  if (typeof inspection.signer.subject !== "string" || inspection.signer.subject.trim().length === 0) {
    throw new Error(`RELEASE_INSPECTION_INVALID: ${abi} signer subject is missing.`);
  }
  if (/CN=Android Debug(?:,|$)/i.test(inspection.signer.subject)) {
    throw new Error(`RELEASE_INSPECTION_INVALID: ${abi} uses the Android debug certificate.`);
  }
  if (typeof inspection.buildToolsVersion !== "string" || inspection.buildToolsVersion.length === 0) {
    throw new Error(`RELEASE_INSPECTION_INVALID: ${abi} Build Tools version is missing.`);
  }
}

function validateSpdxDocument(document, version) {
  if (document?.spdxVersion !== "SPDX-2.3") {
    throw new Error("RELEASE_SPDX_INVALID: expected SPDX-2.3.");
  }
  const root = document.packages?.find((entry) => entry.SPDXID === "SPDXRef-Pocket-Tools");
  if (!root || root.name !== "Pocket Tools" || root.versionInfo !== version) {
    throw new Error(`RELEASE_SPDX_INVALID: root package must describe Pocket Tools ${version}.`);
  }
}

function validateNotices(bytes) {
  const text = bytes.toString("utf8").replace(/\r\n?/g, "\n");
  if (!text.startsWith("# Third-Party Notices\n")) {
    throw new Error("RELEASE_NOTICES_INVALID: notices must begin with the canonical heading.");
  }
}

async function assertExactRegularFileSet(directory, expected) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (cause) {
    throw new Error(`RELEASE_INPUT_INVALID: unable to read ${directory}.`, { cause });
  }
  const names = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (!entry.isFile() || (await lstat(path)).isSymbolicLink()) {
      throw new Error(`RELEASE_INPUT_INVALID: ${entry.name} must be a regular non-symbolic file.`);
    }
    names.push(entry.name);
  }
  const actual = bytewiseSort(names);
  const wanted = bytewiseSort(expected);
  if (!isDeepStrictEqual(actual, wanted)) {
    const missing = wanted.filter((name) => !actual.includes(name));
    const extra = actual.filter((name) => !wanted.includes(name));
    throw new Error(
      `RELEASE_INPUT_SET_INVALID: missing=[${missing.join(", ")}] extra=[${extra.join(", ")}].`,
    );
  }
}

async function assertDirectoryMissingOrEmpty(directory, label) {
  try {
    const information = await stat(directory);
    if (!information.isDirectory()) {
      throw new Error(`RELEASE_OUTPUT_INVALID: ${label} is not a directory at ${directory}.`);
    }
    if ((await readdir(directory)).length !== 0) {
      throw new Error(`RELEASE_OUTPUT_EXISTS: ${label} is not empty at ${directory}.`);
    }
  } catch (cause) {
    if (cause?.code === "ENOENT") return;
    throw cause;
  }
}

function assertDisjointDirectories(directories) {
  for (let leftIndex = 0; leftIndex < directories.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < directories.length; rightIndex += 1) {
      const left = directories[leftIndex];
      const right = directories[rightIndex];
      if (containsPath(left, right) || containsPath(right, left)) {
        throw new Error(`RELEASE_DIRECTORY_OVERLAP: ${left} and ${right} must not overlap.`);
      }
    }
  }
}

function containsPath(parent, child) {
  const path = relative(parent, child);
  return path === "" || (!path.startsWith("..") && !isAbsolute(path));
}

async function readJson(path) {
  return parseJson(await readFile(path), path);
}

function parseJson(bytes, label) {
  try {
    return JSON.parse(bytes.toString("utf8"));
  } catch (cause) {
    throw new Error(`RELEASE_JSON_INVALID: unable to parse ${label}.`, { cause });
  }
}

function compareField(label, actual, expected) {
  if (!isDeepStrictEqual(actual, expected)) {
    throw new Error(
      `RELEASE_INSPECTION_INVALID: ${label} ${JSON.stringify(actual)} does not match ${JSON.stringify(expected)}.`,
    );
  }
}

function normalizeDistinguishedName(value) {
  return String(value)
    .split(/\r?\n/)
    .map((part) => part.trim())
    .filter(Boolean)
    .join(",");
}

function validateAbi(abi) {
  if (!RELEASE_ABIS.includes(abi)) {
    throw new Error(`RELEASE_ABI_INVALID: expected one of ${RELEASE_ABIS.join(", ")}.`);
  }
}

function bytewiseSort(values) {
  return [...values].sort((left, right) => Buffer.from(left).compare(Buffer.from(right)));
}
