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
MIIDKzCCAhOgAwIBAgIUZKqxYoINfsupsEJLhFrOBHfztIYwDQYJKoZIhvcNAQEL
BQAwJDEiMCAGA1UEAwwZUG9ja2V0IFRvb2xzIFRlc3QgUmVsZWFzZTAgFw0yNjA4
MDYyMzE1MDJaGA8yMTI2MDcxMzIzMTUwMlowJDEiMCAGA1UEAwwZUG9ja2V0IFRv
b2xzIFRlc3QgUmVsZWFzZTCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEB
AMNRWau0+hXBKYIBjYaF1WTuFvK1NyCk1Tatzv1fflemM0Jo6kkEu6i+QwFamZ3Z
86cyS2IDREU3bCvpU5M1LFpuk6ZNdXAWmYF7iZNwb9eYaBqsDhbnVYug0VIoijgN
a0WRvmVVagIu8isb8i1N5Ggzx6ITnUmb7uaPjfhiItrR/VXJhc7Cvw0Gktid8hIQ
vNedJmZkdmYdFyCuXUrhOk1h7pm9VWemxmQq8vU9ezGEvX5x4v+m1HJ+Z8L1l6gW
htRo37kV3Qd00zNGI/8Jn3mqVRiHqvya7UfujFTroaGVeMhwzwmlGjt/hCcKsaBZ
s9H6rfqjiHwqP54yezFlw5UCAwEAAaNTMFEwHQYDVR0OBBYEFJN42NSjKUBFF+2r
E1VJUtY21HtWMB8GA1UdIwQYMBaAFJN42NSjKUBFF+2rE1VJUtY21HtWMA8GA1Ud
EwEB/wQFMAMBAf8wDQYJKoZIhvcNAQELBQADggEBAL2bRVHuzpUftBr6bYiOomup
Q8jR5WezXM+5/yRK4hRubmle6H9p8ZQAht5hGYipTY+Z909/fZdYp7UAuFzwgyeK
0dd/El+RvnyzTlg7ecnLvr0rZSf3ozFPIGR1jBF0IVcyM7lAGA442+ifdvmjJo3q
eKz1n82eWCt1hHLKqzpkWUCV6ZSX+d/yWYSg6hgGIHU9XVRJOx1qn+yRFqwitTf7
pXyL7nOghOfNhP3La6zI9L1KOf52aBaz51nMmyRVx+qoqE32FtWLcy8b66VwId3e
Vh0MPAyaMamTGU3IFTuAFt9cGLCRMQs2I93MP7v4wzCCXoWAMGqNDiQsUKRqTnE=
-----END CERTIFICATE-----
`;
const CERTIFICATE_SHA256 = "91ed20dd6fa69d785dd3fe258644a813d3340c3e06fb3043055a5d4091d483ad";

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

test("rejects malformed certificate PEM", () => {
  assert.throws(
    () =>
      certificateMetadata("-----BEGIN CERTIFICATE-----\nnot-base64\n-----END CERTIFICATE-----\n"),
    /RELEASE_CERTIFICATE_INVALID: unable to parse the public certificate PEM/,
  );
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
