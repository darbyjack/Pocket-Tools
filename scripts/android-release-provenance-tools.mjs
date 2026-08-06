import { readFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

import { RELEASE_ABIS, parseReleaseTag, sha256 } from "./release-contract.mjs";

const SHA_PATTERN = /^[0-9a-f]{40}$/;

export function defaultUnsignedInspectionPath({ repositoryRoot, tag, abi }) {
  validateAbi(abi);
  const release = parseReleaseTag(tag);
  return resolve(
    repositoryRoot,
    "release-work",
    "intermediate",
    release.version,
    `pocket-tools-${release.tag}-${abi}-unsigned.apk.inspection.json`,
  );
}

export async function loadUnsignedSigningProvenance({
  apkPath,
  inspectionPath = `${apkPath}.inspection.json`,
  expectedSourceCommit,
  expectedTag,
  expectedAbi,
}) {
  const apk = resolve(apkPath);
  const sidecar = resolve(inspectionPath);
  const [apkBytes, inspection] = await Promise.all([
    readFile(apk),
    readJson(sidecar, "unsigned APK inspection"),
  ]);

  if (!inspection || typeof inspection !== "object" || Array.isArray(inspection)) {
    throw new Error("ANDROID_PROVENANCE_INVALID: unsigned APK inspection must be an object.");
  }
  compareField("handoff", inspection.handoff, "unsigned-intermediate");
  compareField("signed", inspection.signed, false);
  compareField("filename", inspection.filename, basename(apk));
  compareField("byteSize", inspection.byteSize, apkBytes.byteLength);
  compareField("sha256", inspection.sha256, sha256(apkBytes));

  if (!SHA_PATTERN.test(String(inspection.sourceCommit))) {
    throw new Error(
      "ANDROID_PROVENANCE_INVALID: unsigned APK sourceCommit must be a lowercase 40-character SHA.",
    );
  }
  if (expectedSourceCommit !== undefined) {
    compareField("sourceCommit", inspection.sourceCommit, expectedSourceCommit);
  }
  if (expectedTag !== undefined) compareField("tag", inspection.tag, expectedTag);
  if (expectedAbi !== undefined) compareField("abi", inspection.abi, expectedAbi);
  validateAbi(inspection.abi);
  parseReleaseTag(inspection.tag);

  return {
    abi: inspection.abi,
    sourceCommit: inspection.sourceCommit,
    tag: inspection.tag,
  };
}

export function bindSignedInspectionProvenance(inspection, provenance) {
  if (!inspection || typeof inspection !== "object" || Array.isArray(inspection)) {
    throw new Error("ANDROID_PROVENANCE_INVALID: signed APK inspection must be an object.");
  }
  compareField("abi", inspection.abi, provenance.abi);
  return {
    ...inspection,
    sourceCommit: provenance.sourceCommit,
    tag: provenance.tag,
  };
}

export async function validateStagingInspectionProvenance({ identity, inputDirectory }) {
  for (const abi of RELEASE_ABIS) {
    const path = join(
      resolve(inputDirectory),
      `pocket-tools-${identity.tag}-${abi}.apk.inspection.json`,
    );
    const inspection = await readJson(path, `${abi} signed APK inspection`);
    compareField("tag", inspection.tag, identity.tag);
    compareField("sourceCommit", inspection.sourceCommit, identity.sourceCommit);
    compareField("abi", inspection.abi, abi);
  }
}

async function readJson(path, label) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (cause) {
    throw new Error(`ANDROID_PROVENANCE_INVALID: unable to read ${label} at ${path}.`, {
      cause,
    });
  }
}

function compareField(label, actual, expected) {
  if (actual !== expected) {
    throw new Error(
      `ANDROID_PROVENANCE_MISMATCH: ${label} ${JSON.stringify(actual)} does not match ${JSON.stringify(expected)}.`,
    );
  }
}

function validateAbi(abi) {
  if (!RELEASE_ABIS.includes(abi)) {
    throw new Error(`ANDROID_PROVENANCE_INVALID: abi must be one of ${RELEASE_ABIS.join(", ")}.`);
  }
}
