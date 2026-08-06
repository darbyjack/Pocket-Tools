import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  RELEASE_ABIS,
  RELEASE_PACKAGE_NAME,
  RELEASE_SDK_LEVELS,
  expectedReleaseAssetNames,
  sha256,
} from "./release-contract.mjs";
import {
  RELEASE_CERTIFICATE_FILENAME,
  certificateMetadata,
  expectedReleaseInputNames,
  finalApkFilename,
  renderDraftReleaseBody,
  signedInspectionFilename,
  stageReleaseArtifacts,
} from "./release-staging-tools.mjs";

const TEST_CERTIFICATE = `-----BEGIN CERTIFICATE-----
MIIDKTCCAhGgAwIBAgIUZpNu6xFM/Or64EQDqsL2PEng20YwDQYJKoZIhvcNAQEL
BQAwJDEiMCAGA1UEAwwZUG9ja2V0IFRvb2xzIFRlc3QgUmVsZWFzZTAeFw0yNjA4
MDYyMjIxMTJaFw0yNzA4MDYyMjIxMTJaMCQxIjAgBgNVBAMMGVBvY2tldCBUb29s
cyBUZXN0IFJlbGVhc2UwggEiMA0GCSqGSIbDQEBAQUAA4IBDwAwggEKAoIBAQCK
LyHCNDp2NtPEu6aycztvB+HiRQiUxAsj9t4D09tNYUfTrz/QtWPxOvv/aQLHYpFs
x9JRdi697RTsEL48gwxJWaLeoxaREgTzKdD6cdFpT3DMN/0tjSuMDCNxCk+mr9tR
uIM7XDgQLhUyaU4wqSXvC64HJ0OjhzQXsIZk/cI8ZMLwW7v+tqls5vPGEvOGmDlc
acqVLQXkmyK6X8nmCDnEQcb8seDwAjxJqDV33tMZiQAV5bM+LI9UqWNV3WHxVoNk
wWbQKf7VPEFSHLx2ijVnUYrBXnuMyt/O4e1h6etbEzEW6gBSlS5Z90f7IjzuQvWE
GBQEc6nXOC3JPGECNNsVAgMBAAGjUzBRMB0GA1UdDgQWBBSrJVQprW0Aj40Gr01h
eGt/9wb9xTAfBgNVHSMEGDAWgBSrJVQprW0Aj40Gr01heGt/9wb9xTAPBgNVHRMB
Af8EBTADAQH/MA0GCSqGSIb3DQEBCwUAA4IBAQBUNqf4/e8+TAiyO7kP2mhLwQjE
Y5lAyW8C67r5/YCdIvZ8wwfzftLyc3r8hDfrLXBSntC3avbCKQ0GyOiC/ZE2MNe5
118/7x4xo7WXk2o8EOaPxt7FbctYTl6HivZNKECCstupMXN64DpkZTALcOvuoUfk
71UqgBla+V+JJq9IVYrwXAvXQzM8/n5Ukhx5DSOMJnSc+L7MW+O7Znxol+AIl5ij
ZBQsvfeBJcsO/b7aE2ZGsfkcCLTjTk2ADXiTHuaIiCj7Cf9BuKP3c8ngKIA2GwV9
G07AiAcEpz/tHSA2VUgiCUdEj+e0tubCn2JhEwO07+mhxqnElzrlDzrloOWV
-----END CERTIFICATE-----
`;
const CERTIFICATE_SHA256 = "68bf0cc43e65cd92467d04800a247b5892e7dbe413e68def5fb5c6011851fc02";

const identity = {
  schema: "pocket-tools-release-metadata",
  schemaVersion: 1,
  tag: "v0.1.0",
  version: "0.1.0",
  versionCode: 1,
  packageName: RELEASE_PACKAGE_NAME,
  sourceCommit: "a".repeat(40),
  classification: "stable",
  prerelease: false,
  sdk: RELEASE_SDK_LEVELS,
  abis: RELEASE_ABIS,
};

const toolchain = {
  node: { actual: "v24.18.0", required: ">=24.16.0" },
  packageManager: "pnpm@11.17.0",
  expo: "~57.0.9",
  reactNative: "0.86.2",
};

test("builds deterministic final APK, inspection, and input names", () => {
  assert.equal(
    finalApkFilename("v0.1.0-beta.2", "arm64-v8a"),
    "pocket-tools-v0.1.0-beta.2-arm64-v8a.apk",
  );
  assert.equal(
    signedInspectionFilename("v0.1.0", "x86_64"),
    "pocket-tools-v0.1.0-x86_64.apk.inspection.json",
  );
  assert.deepEqual(expectedReleaseInputNames("v0.1.0"), [
    "pocket-tools-v0.1.0-armeabi-v7a.apk",
    "pocket-tools-v0.1.0-armeabi-v7a.apk.inspection.json",
    "pocket-tools-v0.1.0-arm64-v8a.apk",
    "pocket-tools-v0.1.0-arm64-v8a.apk.inspection.json",
    "pocket-tools-v0.1.0-x86.apk",
    "pocket-tools-v0.1.0-x86.apk.inspection.json",
    "pocket-tools-v0.1.0-x86_64.apk",
    "pocket-tools-v0.1.0-x86_64.apk.inspection.json",
    RELEASE_CERTIFICATE_FILENAME,
  ]);
});

test("extracts stable certificate metadata", () => {
  assert.deepEqual(certificateMetadata(TEST_CERTIFICATE), {
    filename: RELEASE_CERTIFICATE_FILENAME,
    pemSubject: "CN=Pocket Tools Test Release",
    sha256: CERTIFICATE_SHA256,
  });
});

test("stages and independently verifies the exact nine release assets", async () => {
  const fixture = await createFixture();
  try {
    const result = await stageFixture(fixture);
    assert.deepEqual(
      (await readdir(fixture.output)).sort(),
      expectedReleaseAssetNames(identity.tag).sort(),
    );
    assert.equal(result.verifiedDigests, 8);
    assert.equal(result.releaseAssets.length, 9);
    assert.deepEqual((await readdir(fixture.publication)).sort(), [
      "pocket-tools-v0.1.0-acceptance-checklist.md",
      "pocket-tools-v0.1.0-release-notes.md",
    ]);
    const metadata = JSON.parse(
      await readFile(join(fixture.output, "pocket-tools-v0.1.0-release.json"), "utf8"),
    );
    assert.equal(metadata.apks.length, 4);
    assert.equal(metadata.signingCertificate.sha256, CERTIFICATE_SHA256);
    assert.equal(metadata.toolchain.androidBuildTools, "36.0.0");
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("rejects extra clean-room inputs", async () => {
  const fixture = await createFixture();
  try {
    await writeFile(join(fixture.input, "extra.txt"), "unexpected", "utf8");
    await assert.rejects(() => stageFixture(fixture), /RELEASE_INPUT_SET_INVALID.*extra\.txt/);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("rejects APK digest drift before writing staging output", async () => {
  const fixture = await createFixture();
  try {
    const abi = "arm64-v8a";
    const inspectionPath = join(fixture.input, signedInspectionFilename(identity.tag, abi));
    const inspection = JSON.parse(await readFile(inspectionPath, "utf8"));
    inspection.sha256 = "0".repeat(64);
    await writeFile(inspectionPath, JSON.stringify(inspection), "utf8");
    await assert.rejects(() => stageFixture(fixture), /RELEASE_INSPECTION_INVALID: sha256/);
    await assert.rejects(() => readdir(fixture.output), /ENOENT/);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("draft release body requires explicit known-limitations review", () => {
  const body = renderDraftReleaseBody({
    ...identity,
    apks: RELEASE_ABIS.map((abi) => ({
      abi,
      filename: finalApkFilename(identity.tag, abi),
      sha256: "a".repeat(64),
    })),
    signingCertificate: {
      subject: "CN=Pocket Tools Test Release",
      sha256: CERTIFICATE_SHA256,
    },
  });
  assert.match(body, /Maintainer review required/);
  assert.match(body, /Do not rebuild, re-sign, rename, or replace/);
});

async function createFixture() {
  const root = await mkdtemp(join(tmpdir(), "pocket-tools-release-stage-"));
  const input = join(root, "input");
  const output = join(root, "output");
  const publication = join(root, "publication");
  await mkdir(input);
  await writeFile(join(input, RELEASE_CERTIFICATE_FILENAME), TEST_CERTIFICATE, "utf8");
  for (const abi of RELEASE_ABIS) {
    const filename = finalApkFilename(identity.tag, abi);
    const bytes = Buffer.from(`signed-apk-${abi}`);
    await writeFile(join(input, filename), bytes);
    await writeFile(
      join(input, signedInspectionFilename(identity.tag, abi)),
      JSON.stringify({
        abi,
        aligned: true,
        buildToolsVersion: "36.0.0",
        byteSize: bytes.byteLength,
        filename,
        nativeLibraries: ["libc++_shared.so", "libpocketquickjs.so"],
        packageName: identity.packageName,
        sdk: { compile: 36, min: 24, target: 36 },
        sha256: sha256(bytes),
        signer: {
          index: 1,
          subject: "CN=Pocket Tools Test Release",
          sha256: CERTIFICATE_SHA256,
        },
        versionCode: identity.versionCode,
        versionName: identity.version,
      }),
      "utf8",
    );
  }
  const spdxPath = join(root, "source.spdx.json");
  await writeFile(
    spdxPath,
    JSON.stringify({
      spdxVersion: "SPDX-2.3",
      packages: [
        {
          SPDXID: "SPDXRef-Pocket-Tools",
          name: "Pocket Tools",
          versionInfo: identity.version,
        },
      ],
    }),
    "utf8",
  );
  const noticesPath = join(root, "notices.md");
  await writeFile(noticesPath, "# Third-Party Notices\n\nFixture notices.\n", "utf8");
  const checklistPath = join(root, "checklist.md");
  await writeFile(
    checklistPath,
    "# Draft Release Acceptance Checklist\n\n- [ ] Verify exact bytes.\n",
    "utf8",
  );
  return { root, input, output, publication, spdxPath, noticesPath, checklistPath };
}

function stageFixture(fixture) {
  return stageReleaseArtifacts({
    identity,
    inputDirectory: fixture.input,
    outputDirectory: fixture.output,
    publicationDirectory: fixture.publication,
    spdxPath: fixture.spdxPath,
    noticesPath: fixture.noticesPath,
    canonicalChecklistPath: fixture.checklistPath,
    toolchain,
  });
}
