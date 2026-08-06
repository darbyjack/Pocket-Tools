import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  assertUnsignedApkVerification,
  buildExpoPrebuildCommand,
  buildGradleCommand,
  findSingleReleaseApk,
  intermediateApkFilename,
  validateGeneratedGradleProperties,
  validateReleaseAbi,
  validateUnsignedApkInspection,
} from "./android-release-build-tools.mjs";

const require = createRequire(import.meta.url);
const { removeReleaseDebugSigning } = require("../apps/mobile/plugins/with-unsigned-release-build.cjs");

const GRADLE_FIXTURE = `android {
  signingConfigs {
    debug {
      storeFile file('debug.keystore')
    }
  }
  buildTypes {
    debug {
      signingConfig signingConfigs.debug
    }
    release {
      // Production signing is centralized after the build.
      signingConfig signingConfigs.debug
      minifyEnabled true
    }
  }
}
`;

test("removes only the release debug signing configuration", () => {
  const output = removeReleaseDebugSigning(GRADLE_FIXTURE);
  assert.match(output, /debug \{\s+signingConfig signingConfigs\.debug/s);
  assert.doesNotMatch(output, /release \{[^}]*signingConfig/s);
  assert.match(output, /release \{[\s\S]*minifyEnabled true/);
});

test("fails closed when the generated release signing shape changes", () => {
  assert.throws(
    () =>
      removeReleaseDebugSigning(
        GRADLE_FIXTURE.replace(
          "signingConfigs.debug\n      minify",
          "signingConfigs.release\n      minify",
        ),
      ),
    /UNSIGNED_RELEASE_CONFIG_INVALID/,
  );
  assert.throws(
    () =>
      removeReleaseDebugSigning(
        GRADLE_FIXTURE.replace("      signingConfig signingConfigs.debug\n      minify", "      minify"),
      ),
    /UNSIGNED_RELEASE_CONFIG_INVALID/,
  );
});

test("builds deterministic intermediate names and validates ABIs", () => {
  assert.equal(
    intermediateApkFilename("v0.1.0-beta.2", "arm64-v8a"),
    "pocket-tools-v0.1.0-beta.2-arm64-v8a-unsigned.apk",
  );
  assert.equal(validateReleaseAbi("x86_64"), "x86_64");
  assert.throws(() => validateReleaseAbi("universal"), /ANDROID_BUILD_ARGUMENT_INVALID/);
});

test("constructs clean prebuild and isolated Gradle commands", () => {
  assert.deepEqual(buildExpoPrebuildCommand("win32"), {
    executable: "pnpm.cmd",
    args: [
      "--dir",
      "apps/mobile",
      "exec",
      "expo",
      "prebuild",
      "--platform",
      "android",
      "--clean",
      "--no-install",
    ],
  });
  const gradle = buildGradleCommand({
    androidDirectory: "C:/repo/apps/mobile/android",
    abi: "x86",
    projectCacheDirectory: "C:/repo/release-work/cache/x86",
    platform: "win32",
  });
  assert.match(gradle.executable.replaceAll("\\", "/"), /apps\/mobile\/android\/gradlew\.bat$/);
  assert.deepEqual(gradle.args.slice(0, 4), [
    ":app:assembleRelease",
    "-PreactNativeArchitectures=x86",
    "--no-daemon",
    "--stacktrace",
  ]);
  assert.equal(gradle.args[4], "--project-cache-dir");
});

test("validates generated ABI and release optimization properties", () => {
  assert.deepEqual(
    validateGeneratedGradleProperties(`
reactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64
android.enableMinifyInReleaseBuilds=true
android.enableShrinkResourcesInReleaseBuilds=true
`),
    {
      reactNativeArchitectures: ["armeabi-v7a", "arm64-v8a", "x86", "x86_64"],
      minifyRelease: true,
      shrinkResourcesRelease: true,
    },
  );
  assert.throws(
    () => validateGeneratedGradleProperties("reactNativeArchitectures=arm64-v8a\n"),
    /ANDROID_BUILD_CONFIG_INVALID/,
  );
});

test("finds exactly one Gradle release APK", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pocket-tools-apk-output-"));
  try {
    await mkdir(join(directory, "nested"));
    await writeFile(join(directory, "nested", "app-release-unsigned.apk"), "apk");
    assert.equal(
      await findSingleReleaseApk(directory),
      join(directory, "nested", "app-release-unsigned.apk"),
    );
    await writeFile(join(directory, "other.apk"), "apk");
    await assert.rejects(() => findSingleReleaseApk(directory), /ANDROID_BUILD_OUTPUT_INVALID/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("requires unsigned centralized-signing intermediates", () => {
  assert.equal(assertUnsignedApkVerification({ status: 1, stdout: "", stderr: "" }), true);
  assert.throws(
    () => assertUnsignedApkVerification({ status: 0, stdout: "Verified", stderr: "" }),
    /ANDROID_BUILD_INTERMEDIATE_SIGNED/,
  );
});

test("validates unsigned package, SDK, ABI, and native libraries", () => {
  const result = validateUnsignedApkInspection({
    badging: {
      packageName: "com.darbyjack.pockettools",
      versionName: "0.1.0",
      versionCode: 1,
      minSdk: 24,
      compileSdk: 36,
      targetSdk: 36,
      nativeAbis: ["arm64-v8a"],
      debuggable: false,
      testOnly: false,
    },
    nativeLibraries: {
      "arm64-v8a": ["libc++_shared.so", "libpocketquickjs.so"],
    },
    expected: { versionName: "0.1.0", versionCode: 1, abi: "arm64-v8a" },
    aligned: true,
  });
  assert.equal(result.signed, false);
  assert.equal(result.abi, "arm64-v8a");
  assert.throws(
    () =>
      validateUnsignedApkInspection({
        badging: { ...result, nativeAbis: ["arm64-v8a"], debuggable: true, testOnly: false },
        nativeLibraries: { "arm64-v8a": ["libc++_shared.so"] },
        expected: { versionName: "0.1.0", versionCode: 1, abi: "arm64-v8a" },
        aligned: true,
      }),
    /ANDROID_BUILD_INSPECTION_FAILED/,
  );
});
