import { readdir } from "node:fs/promises";
import { join, resolve } from "node:path";

import { REQUIRED_NATIVE_LIBRARIES } from "./android-release-tools.mjs";
import {
  RELEASE_ABIS,
  RELEASE_PACKAGE_NAME,
  RELEASE_SDK_LEVELS,
  parseReleaseTag,
} from "./release-contract.mjs";

export function validateReleaseAbi(abi) {
  if (!RELEASE_ABIS.includes(abi)) {
    throw new Error(
      `ANDROID_BUILD_ARGUMENT_INVALID: ABI must be one of ${RELEASE_ABIS.join(", ")}.`,
    );
  }
  return abi;
}

export function intermediateApkFilename(tag, abi) {
  const parsed = parseReleaseTag(tag);
  validateReleaseAbi(abi);
  return `pocket-tools-${parsed.tag}-${abi}-unsigned.apk`;
}

export function intermediateInspectionFilename(tag, abi) {
  return `${intermediateApkFilename(tag, abi)}.inspection.json`;
}

export function buildPnpmCommand(
  args,
  {
    nodeExecutable = process.execPath,
    pnpmEntry = process.env.npm_execpath,
    repositoryRoot = process.cwd(),
  } = {},
) {
  if (typeof pnpmEntry !== "string" || pnpmEntry.trim().length === 0) {
    throw new Error(
      "ANDROID_BUILD_PNPM_MISSING: invoke the release build through pnpm so npm_execpath identifies the pinned pnpm CLI.",
    );
  }
  return {
    executable: nodeExecutable,
    args: [resolve(pnpmEntry), ...args],
    cwd: resolve(repositoryRoot),
  };
}

export function buildExpoPrebuildCommand(options = {}) {
  return buildPnpmCommand(
    [
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
    options,
  );
}

export function buildGradleCommand({
  androidDirectory,
  abi,
  projectCacheDirectory,
  javaExecutable,
}) {
  validateReleaseAbi(abi);
  if (typeof javaExecutable !== "string" || javaExecutable.trim().length === 0) {
    throw new Error("ANDROID_BUILD_JAVA_MISSING: a discovered Java executable is required.");
  }
  const resolvedAndroidDirectory = resolve(androidDirectory);
  return {
    executable: javaExecutable,
    args: [
      "-classpath",
      resolve(resolvedAndroidDirectory, "gradle", "wrapper", "gradle-wrapper.jar"),
      "org.gradle.wrapper.GradleWrapperMain",
      ":app:assembleRelease",
      `-PreactNativeArchitectures=${abi}`,
      "--no-daemon",
      "--stacktrace",
      "--project-cache-dir",
      resolve(projectCacheDirectory),
    ],
    cwd: resolvedAndroidDirectory,
  };
}

export function validateGeneratedGradleProperties(text) {
  const properties = parseProperties(text);
  const architectures = String(properties.get("reactNativeArchitectures") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (JSON.stringify(architectures) !== JSON.stringify(RELEASE_ABIS)) {
    throw new Error(
      `ANDROID_BUILD_CONFIG_INVALID: reactNativeArchitectures must be ${RELEASE_ABIS.join(",")}.`,
    );
  }
  for (const name of [
    "android.enableMinifyInReleaseBuilds",
    "android.enableShrinkResourcesInReleaseBuilds",
  ]) {
    if (properties.get(name) !== "true") {
      throw new Error(`ANDROID_BUILD_CONFIG_INVALID: ${name} must be true.`);
    }
  }
  return {
    reactNativeArchitectures: architectures,
    minifyRelease: true,
    shrinkResourcesRelease: true,
  };
}

export async function findSingleReleaseApk(directory) {
  const matches = [];
  await collectApks(resolve(directory), matches);
  if (matches.length !== 1) {
    throw new Error(
      `ANDROID_BUILD_OUTPUT_INVALID: expected exactly one release APK, found ${matches.length}.`,
    );
  }
  return matches[0];
}

export function assertUnsignedApkVerification(result) {
  if (result.error) {
    throw new Error("ANDROID_BUILD_SIGNATURE_CHECK_FAILED: apksigner could not be executed.", {
      cause: result.error,
    });
  }
  if (result.status === 0) {
    throw new Error(
      "ANDROID_BUILD_INTERMEDIATE_SIGNED: release intermediate is already signed and cannot enter centralized signing.",
    );
  }
  return true;
}

export function validateUnsignedApkInspection({ badging, nativeLibraries, expected, aligned }) {
  const failures = [];
  compareField(
    failures,
    "package",
    badging.packageName,
    expected.packageName ?? RELEASE_PACKAGE_NAME,
  );
  compareField(failures, "versionName", badging.versionName, expected.versionName);
  compareField(failures, "versionCode", badging.versionCode, expected.versionCode);
  compareField(failures, "minSdk", badging.minSdk, expected.minSdk ?? RELEASE_SDK_LEVELS.min);
  compareField(
    failures,
    "compileSdk",
    badging.compileSdk,
    expected.compileSdk ?? RELEASE_SDK_LEVELS.compile,
  );
  compareField(
    failures,
    "targetSdk",
    badging.targetSdk,
    expected.targetSdk ?? RELEASE_SDK_LEVELS.target,
  );
  if (badging.debuggable) failures.push("manifest is debuggable");
  if (badging.testOnly) failures.push("manifest is testOnly");
  if (!aligned) failures.push("APK is not zipaligned for 16 KiB native-library pages");

  const expectedAbi = validateReleaseAbi(expected.abi);
  const badgingAbis = [...badging.nativeAbis].sort(bytewiseCompare);
  if (badgingAbis.length !== 1 || badgingAbis[0] !== expectedAbi) {
    failures.push(
      `badging native ABIs are [${badgingAbis.join(", ")}] instead of [${expectedAbi}]`,
    );
  }
  const archiveAbis = Object.keys(nativeLibraries).sort(bytewiseCompare);
  if (archiveAbis.length !== 1 ||…É¡¥Ù•‰¥ÍlÁt€„ôô•áÁ•Ñ•‘‰¤¤ì(€€€™…¥±ÕÉ•Ì¹ÁÕÍ  (€€€€€…É¡¥Ù”¹…Ñ¥Ù”	%Ì…É”l‘í…É¡¥Ù•‰¥Ì¹©½¥¸ ˆ°€ˆ¥õt¥¹ÍÑ•…½˜l‘í•áÁ•Ñ•‘‰¥õu€°(€€€€¤ì(€ô(€½¹ÍĞ¹…µ•Ì€ô¹…Ñ¥Ù•1¥‰É…É¥•Ím•áÁ•Ñ•‘‰¥t€üümtì(€™½È€¡½¹ÍĞÉ•ÅÕ¥É•½˜IEU%I}9Q%Y}1%	II%L¤ì(€€€¥˜€ …¹…µ•Ì¹¥¹±Õ‘•Ì¡É•ÅÕ¥É•¤¤™…¥±ÕÉ•Ì¹ÁÕÍ ¡€‘íÉ•ÅÕ¥É•‘ô¥Ìµ¥ÍÍ¥¹œ™½È€‘í•áÁ•Ñ•‘‰¥õ€¤ì(€ô(€¥˜€¡™…¥±ÕÉ•Ì¹±•¹Ñ €„ôô€À¤ì(€€€Ñ¡É½Ü¹•ÜÉÉ½È¡9I=%}	U%1}%9MAQ%=9}%1è€‘í™…¥±ÕÉ•Ì¹©½¥¸ ˆì€ˆ¥ô¹€¤ì(€ô(€É•ÑÕÉ¸ì(€€€Á…­…•9…µ”è‰…‘¥¹œ¹Á…­…•9…µ”°(€€€Ù•ÉÍ¥½¹9…µ”è‰…‘¥¹œ¹Ù•ÉÍ¥½¹9…µ”°(€€€Ù•ÉÍ¥½¹½‘”è‰…‘¥¹œ¹Ù•ÉÍ¥½¹½‘”°(€€€Í‘¬èì(€€€€€µ¥¸è‰…‘¥¹œ¹µ¥¹M‘¬°(€€€€€½µÁ¥±”è‰…‘¥¹œ¹½µÁ¥±•M‘¬°(€€€€€Ñ…É•Ğè‰…‘¥¹œ¹Ñ…É•ÑM‘¬°(€€€ô°(€€€…‰¤è•áÁ•Ñ•‘‰¤°(€€€¹…Ñ¥Ù•1¥‰É…É¥•Ìè¹…µ•Ì°(€€€…±¥¹•èÑÉÕ”°(€€€Í¥¹•è™…±Í”°(€ôì)ô()™Õ¹Ñ¥½¸Á…ÉÍ•AÉ½Á•ÉÑ¥•Ì¡Ñ•áĞ¤ì(€½¹ÍĞÉ•ÍÕ±Ğ€ô¹•Ü5…À ¤ì(€™½È€¡½¹ÍĞÉ…İ1¥¹”½˜MÑÉ¥¹œ¡Ñ•áĞ¤¹É•Á±…” ½qÉq¸ü½œ°€‰q¸ˆ¤¹ÍÁ±¥Ğ ‰q¸ˆ¤¤ì(€€€½¹ÍĞ±¥¹”€ôÉ…İ1¥¹”¹ÑÉ¥´ ¤ì(€€€¥˜€ …±¥¹”ñğ±¥¹”¹ÍÑ…ÉÑÍ]¥Ñ  ˆŒˆ¤ñğ±¥¹”¹ÍÑ…ÉÑÍ]¥Ñ  ˆ„ˆ¤¤½¹Ñ¥¹Õ”ì(€€€½¹ÍĞÍ•Á…É…Ñ½È€ô±¥¹”¹Í•…É  ½lèõt¼¤ì(€€€½¹ÍĞ­•ä€ô€¡Í•Á…É…Ñ½È€ôôô€´Ä€ü±¥¹”€è±¥¹”¹Í±¥” À°Í•Á…É…Ñ½È¤¤¹ÑÉ¥´ ¤ì(€€€½¹ÍĞÙ…±Õ”€ô€¡Í•Á…É…Ñ½È€ôôô€´Ä€ü€ˆˆ€è±¥¹”¹Í±¥”¡Í•Á…É…Ñ½È€¬€Ä¤¤¹ÑÉ¥´ ¤ì(€€€É•ÍÕ±Ğ¹Í•Ğ¡­•ä°Ù…±Õ”¤ì(€ô(€É•ÑÕÉ¸É•ÍÕ±Ğì)ô()…Íå¹Œ™Õ¹Ñ¥½¸½±±•ÑÁ­Ì¡‘¥É•Ñ½Éä°µ…Ñ¡•Ì¤ì(€™½È€¡½¹ÍĞ•¹ÑÉä½˜…İ…¥ĞÉ•…‘‘¥È¡‘¥É•Ñ½Éä°ìİ¥Ñ¡¥±•QåÁ•ÌèÑÉÕ”ô¤¤ì(€€€½¹ÍĞÁ…Ñ €ô©½¥¸¡‘¥É•Ñ½Éä°•¹ÑÉä¹¹…µ”¤ì(€€€¥˜€¡•¹ÑÉä¹¥Í¥É•Ñ½Éä ¤¤…İ…¥Ğ½±±•ÑÁ­Ì¡Á…Ñ °µ…Ñ¡•Ì¤ì(€€€•±Í”¥˜€¡•¹ÑÉä¹¥Í¥±” ¤€˜˜•¹ÑÉä¹¹…µ”¹•¹‘Í]¥Ñ  ˆ¹…Á¬ˆ¤¤µ…Ñ¡•Ì¹ÁÕÍ ¡Á…Ñ ¤ì(€ô)ô()™Õ¹Ñ¥½¸½µÁ…É•¥•±¡™…¥±ÕÉ•Ì°±…‰•°°…ÑÕ…°°•áÁ•Ñ•¤ì(€¥˜€¡…ÑÕ…°€„ôô•áÁ•Ñ•¤ì(€€€™…¥±ÕÉ•Ì¹ÁÕÍ ¡€‘í±…‰•±ô€‘í)M=8¹ÍÑÉ¥¹¥™ä¡…ÑÕ…°¥ô‘½•Ì¹½Ğµ…Ñ €‘í)M=8¹ÍÑÉ¥¹¥™ä¡•áÁ•Ñ•¥õ€¤ì(€ô)ô()™Õ¹Ñ¥½¸‰åÑ•İ¥Í•½µÁ…É”¡±•™Ğ°É¥¡Ğ¤ì(€É•ÑÕÉ¸	Õ™™•È¹™É½´¡±•™Ğ¤¹½µÁ…É”¡	Õ™™•È¹™É½´¡É¥¡Ğ¤¤ì)ô(