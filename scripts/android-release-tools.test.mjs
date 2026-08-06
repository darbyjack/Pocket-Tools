import assert from "node:assert/strict";
import test from "node:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  KEYSTORE_PASSWORD_ENV,
  KEY_PASSWORD_ENV,
  buildApksignerArguments,
  buildTestKeyArguments,
  discoverAndroidTools,
  extractCertificatePem,
  inspectNativeLibraries,
  parseAapt2Badging,
  parseApksignerOutput,
  parseJarEntries,
  validateApkInspection,
} from "./android-release-tools.mjs";

const fingerprint = "ab".repeat(32);
const badgingText = `package: name='com.darbyjack.pockettools' versionCode='1' versionName='0.1.0' compileSdkVersion='36' compileSdkVersionCodename='16'
sdkVersion:'24'
targetSdkVersion:'36'
application-label:'Pocket Tools'
native-code: 'arm64-v8a'`;
const signerText = `Verifies
Verified using v1 scheme (JAR signing): true
Verified using v2 scheme (APK Signature Scheme v2): true
Number of signers: 1
Signer #1 certificate DN: CN=Pocket Tools Test Release
Signer #1 certificate SHA-256 digest: ${fingerprint}`;

test("parses package, SDK, ABI, and manifest flags from AAPT2 badging", () => {
  assert.deepEqual(parseAapt2Badging(badgingText), {
    packageName: "com.darbyjack.pockettools",
    versionName: "0.1.0",
    versionCode: 1,
    minSdk: 24,
    compileSdk: 36,
    targetSdk: 36,
    nativeAbis: ["arm64-v8a"],
    debuggable: false,
    testOnly: false,
  });
});

test("finds native libraries without allowing a second ABI", () => {
  const entries = parseJarEntries(
    "AndroidManifest.xml\nlib/arm64-v8a/libpocketquickjs.so\nlib/arm64-v8a/libc++_shared.so\n",
  );
  assert.deepEqual(inspectNativeLibraries(entries), {
    "arm64-v8a": ["libc++_shared.so", "libpocketquickjs.so"],
  });
});

test("parses exactly one APK signing certificate", () => {
  assert.deepEqual(parseApksignerOutput(signerText), {
    signers: [
      {
        index: 1,
        subject: "CN=Pocket Tools Test Release",
        sha256: fingerprint,
      },
    ],
  });
});

test("validates a release APK inspection", () => {
  const result = validateApkInspection({
    badging: parseAapt2Badging(badgingText),
    nativeLibraries: {
      "arm64-v8a": ["libc++_shared.so", "libpocketquickjs.so"],
    },
    signature: parseApksignerOutput(signerText),
    aligned: true,
    expected: {
      packageName: "com.darbyjack.pockettools",
      versionName: "0.1.0",
      versionCode: 1,
      minSdk: 24,
      compileSdk: 36,
      targetSdk: 36,
      abi: "arm64-v8a",
      certificateFingerprint: fingerprint,
      certificateSubject: "CN=Pocket Tools Test Release",
    },
  });
  assert.equal(result.abi, "arm64-v8a");
  assert.equal(result.signer.sha256, fingerprint);
});

test("rejects debug, multi-ABI, missing-library, and fingerprint drift", () => {
  assert.throws(
    () =>
      validateApkInspection({
        badging: {
          ...parseAapt2Badging(`${badgingText}\napplication-debuggable`),
          nativeAbis: ["arm64-v8a", "x86_64"],
        },
        nativeLibraries: {
          "arm64-v8a": ["libpocketquickjs.so"],
          x86_64: ["libc++_shared.so", "libpocketquickjs.so"],
        },
        signature: parseApksignerOutput(signerText),
        aligned: false,
        expected: {
          packageName: "com.darbyjack.pockettools",
          versionName: "0.1.0",
          versionCode: 1,
          minSdk: 24,
          compileSdk: 36,
          targetSdk: 36,
          abi: "arm64-v8a",
          certificateFingerprint: "cd".repeat(32),
        },
      }),
    /debuggable.*not zipaligned.*native ABIs.*archive native ABIs.*libc\+\+_shared.*fingerprint/s,
  );
});

test("uses environment-backed passwords for test-key and APK signing commands", () => {
  const keyArgs = buildTestKeyArguments({ keystore: "test.p12" });
  assert.deepEqual(keyArgs.slice(keyArgs.indexOf("-storepass:env"), keyArgs.indexOf("-storepass:env") + 2), [
    "-storepass:env",
    KEYSTORE_PASSWORD_ENV,
  ]);
  assert.deepEqual(keyArgs.slice(keyArgs.indexOf("-keypass:env"), keyArgs.indexOf("-keypass:env") + 2), [
    "-keypass:env",
    KEY_PASSWORD_ENV,
  ]);

  const signArgs = buildApksignerArguments({
    input: "aligned.apk",
    output: "signed.apk",
    keystore: "test.p12",
    alias: "pocket-tools-test-release",
  });
  assert.ok(signArgs.includes(`env:${KEYSTORE_PASSWORD_ENV}`));
  assert.ok(signArgs.includes(`env:${KEY_PASSWORD_ENV}`));
  assert.equal(signArgs[signArgs.indexOf("--out") + 1], "signed.apk");
  assert.equal(signArgs.at(-1), "aligned.apk");
});

test("pins Android SDK Build Tools 36.0.0 by default", async () => {
  const root = await mkdtemp(join(tmpdir(), "pocket-tools-android-tools-"));
  try {
    for (const version of ["36.0.0", "37.0.0"]) {
      const directory = join(root, "sdk", "build-tools", version);
      await mkdir(join(directory, "lib"), { recursive: true });
      for (const filename of ["aapt2", "zipalign"]) {
        await writeFile(join(directory, filename), "", "utf8");
      }
      await writeFile(join(directory, "lib", "apksigner.jar"), "", "utf8");
    }
    const javaBin = join(root, "java", "bin");
    await mkdir(javaBin, { recursive: true });
    for (const filename of ["java", "jar", "keytool"]) {
      await writeFile(join(javaBin, filename), "", "utf8");
    }

    const tools = await discoverAndroidTools({
      env: { ANDROID_SDK_ROOT: join(root, "sdk"), JAVA_HOME: join(root, "java"), PATH: "" },
      platform: "linux",
    });
    assert.equal(tools.buildToolsVersion, "36.0.0");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("extracts one PEM certificate and rejects multiple signers", () => {
  const pem = "-----BEGIN CERTIFICATE-----\nQUJD\n-----END CERTIFICATE-----";
  assert.equal(extractCertificatePem(`Signer #1\n${pem}\n`), `${pem}\n`);
  assert.throws(() => extractCertificatePem(`${pem}\n${pem}\n`), /exactly one PEM/);
});
