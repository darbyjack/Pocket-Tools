import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { delimiter, join, resolve } from "node:path";

export const REQUIRED_NATIVE_LIBRARIES = ["libc++_shared.so", "libpocketquickjs.so"];
export const TEST_SIGNING_ALIAS = "pocket-tools-test-release";
export const TEST_SIGNING_SUBJECT = "CN=Pocket Tools Test Release";
export const KEYSTORE_PASSWORD_ENV = "ANDROID_RELEASE_KEYSTORE_PASSWORD";
export const KEY_PASSWORD_ENV = "ANDROID_RELEASE_KEY_PASSWORD";
export const DEFAULT_BUILD_TOOLS_VERSION = "36.0.0";

const BUILD_TOOLS_VERSION_PATTERN = /^(\d+)\.(\d+)\.(\d+)$/;
const SHA256_FINGERPRINT_PATTERN = /^[0-9a-f]{64}$/;

export async function discoverAndroidTools({
  env = process.env,
  platform = process.platform,
  buildToolsVersion,
} = {}) {
  const sdkRoot = env.ANDROID_SDK_ROOT || env.ANDROID_HOME;
  if (!sdkRoot) {
    throw new Error(
      "ANDROID_TOOLS_MISSING: set ANDROID_SDK_ROOT or ANDROID_HOME to an Android SDK installation.",
    );
  }
  const buildToolsRoot = join(sdkRoot, "build-tools");
  if (!existsSync(buildToolsRoot)) {
    throw new Error(`ANDROID_TOOLS_MISSING: ${buildToolsRoot} does not exist.`);
  }

  const versions = (await readdir(buildToolsRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && BUILD_TOOLS_VERSION_PATTERN.test(entry.name))
    .map((entry) => entry.name)
    .sort(compareBuildToolsVersions);
  const selected = buildToolsVersion ?? DEFAULT_BUILD_TOOLS_VERSION;
  if (!selected || !versions.includes(selected)) {
    throw new Error(
      `ANDROID_TOOLS_MISSING: Android SDK Build Tools ${selected} is not installed.`,
    );
  }

  const directory = join(buildToolsRoot, selected);
  const executableSuffix = platform === "win32" ? ".exe" : "";
  const aapt2 = requireFile(join(directory, `aapt2${executableSuffix}`), "aapt2");
  const zipalign = requireFile(join(directory, `zipalign${executableSuffix}`), "zipalign");
  const apksignerJar = requireFile(join(directory, "lib", "apksigner.jar"), "apksigner.jar");
  const java = resolveJavaTool("java", env, platform);
  const jar = resolveJavaTool("jar", env, platform);
  const keytool = resolveJavaTool("keytool", env, platform);

  return {
    sdkRoot: resolve(sdkRoot),
    buildToolsVersion: selected,
    aapt2,
    zipalign,
    java,
    jar,
    keytool,
    apksignerJar,
  };
}

export function parseAapt2Badging(text) {
  const normalized = normalizeOutput(text);
  const packageLine = normalized.split("\n").find((line) => line.startsWith("package: "));
  if (!packageLine) {
    throw new Error("APK_BADGING_INVALID: package metadata is missing.");
  }

  const packageName = requireAttribute(packageLine, "name", "package name");
  const versionName = requireAttribute(packageLine, "versionName", "versionName");
  const versionCodeText = requireAttribute(packageLine, "versionCode", "versionCode");
  const compileSdkText = requireAttribute(packageLine, "compileSdkVersion", "compileSdkVersion");
  const minSdkText = requireLineValue(normalized, "sdkVersion", "minimum SDK");
  const targetSdkText = requireLineValue(normalized, "targetSdkVersion", "target SDK");
  const nativeLine = normalized.split("\n").find((line) => line.startsWith("native-code:"));
  const nativeAbis = nativeLine ? [...nativeLine.matchAll(/'([^']+)'/g)].map((match) => match[1]) : [];
  const lines = normalized.split("\n");

  return {
    packageName,
    versionName,
    versionCode: parsePositiveInteger(versionCodeText, "versionCode"),
    minSdk: parsePositiveInteger(minSdkText, "minSdk"),
    compileSdk: parsePositiveInteger(compileSdkText, "compileSdk"),
    targetSdk: parsePositiveInteger(targetSdkText, "targetSdk"),
    nativeAbis,
    debuggable: lines.includes("application-debuggable"),
    testOnly: lines.includes("application-testOnly"),
  };
}

export function parseJarEntries(text) {
  const entries = normalizeOutput(text)
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (entries.length === 0) {
    throw new Error("APK_ARCHIVE_INVALID: the APK archive listing is empty.");
  }
  return entries;
}

export function inspectNativeLibraries(entries) {
  const libraries = new Map();
  for (const entry of entries) {
    const match = /^lib\/([^/]+)\/([^/]+\.so)$/.exec(entry);
    if (!match) continue;
    const [, abi, filename] = match;
    const names = libraries.get(abi) ?? [];
    names.push(filename);
    libraries.set(abi, names);
  }
  return Object.fromEntries(
    [...libraries.entries()]
      .sort(([left], [right]) => bytewiseCompare(left, right))
      .map(([abi, names]) => [abi, [...new Set(names)].sort(bytewiseCompare)]),
  );
}

export function parseApksignerOutput(text) {
  const normalized = normalizeOutput(text);
  const signerSubjects = new Map();
  const signerFingerprints = new Map();

  for (const line of normalized.split("\n")) {
    let match = /^Signer #(\d+) certificate DN: (.+)$/.exec(line);
    if (match) {
      signerSubjects.set(Number(match[1]), match[2].trim());
      continue;
    }
    match = /^Signer #(\d+) certificate SHA-256 digest: ([0-9A-Fa-f:]+)$/.exec(line);
    if (match) {
      signerFingerprints.set(Number(match[1]), normalizeFingerprint(match[2]));
    }
  }

  const signerIndexes = [...new Set([...signerSubjects.keys(), ...signerFingerprints.keys()])].sort(
    (left, right) => left - right,
  );
  if (signerIndexes.length === 0) {
    throw new Error("APK_SIGNATURE_INVALID: apksigner did not report a signing certificate.");
  }
  const signers = signerIndexes.map((index) => {
    const subject = signerSubjects.get(index);
    const fingerprint = signerFingerprints.get(index);
    if (!subject || !fingerprint) {
      throw new Error(`APK_SIGNATURE_INVALID: signer #${index} metadata is incomplete.`);
    }
    return { index, subject, sha256: fingerprint };
  });
  return { signers };
}

export function extractCertificatePem(text) {
  const matches = normalizeOutput(text).match(
    /-----BEGIN CERTIFICATE-----\n[\s\S]+?\n-----END CERTIFICATE-----/g,
  );
  if (!matches || matches.length !== 1) {
    throw new Error("APK_CERTIFICATE_INVALID: expected exactly one PEM certificate.");
  }
  return `${matches[0]}\n`;
}

export function validateApkInspection({
  badging,
  nativeLibraries,
  signature,
  expected,
  aligned,
}) {
  const failures = [];
  compareField(failures, "package", badging.packageName, expected.packageName);
  compareField(failures, "versionName", badging.versionName, expected.versionName);
  compareField(failures, "versionCode", badging.versionCode, expected.versionCode);
  compareField(failures, "minSdk", badging.minSdk, expected.minSdk);
  compareField(failures, "compileSdk", badging.compileSdk, expected.compileSdk);
  compareField(failures, "targetSdk", badging.targetSdk, expected.targetSdk);

  if (badging.debuggable) failures.push("manifest is debuggable");
  if (badging.testOnly) failures.push("manifest is testOnly");
  if (!aligned) failures.push("APK is not zipaligned for 16 KiB native-library pages");

  const badgingAbis = [...badging.nativeAbis].sort(bytewiseCompare);
  if (badgingAbis.length !== 1 || badgingAbis[0] !== expected.abi) {
    failures.push(`badging native ABIs are [${badgingAbis.join(", ")}] instead of [${expected.abi}]`);
  }

  const archiveAbis = Object.keys(nativeLibraries).sort(bytewiseCompare);
  if (archiveAbis.length !== 1 || archiveAbis[0] !== expected.abi) {
    failures.push(`archive native ABIs are [${archiveAbis.join(", ")}] instead of [${expected.abi}]`);
  }
  const names = nativeLibraries[expected.abi] ?? [];
  for (const required of REQUIRED_NATIVE_LIBRARIES) {
    if (!names.includes(required)) failures.push(`${required} is missing for ${expected.abi}`);
  }

  if (signature.signers.length !== 1) {
    failures.push(`expected exactly one signer, received ${signature.signers.length}`);
  } else {
    const signer = signature.signers[0];
    if (/CN=Android Debug(?:,|$)/i.test(signer.subject)) {
      failures.push("APK uses the Android debug certificate");
    }
    if (expected.certificateFingerprint) {
      const wanted = normalizeFingerprint(expected.certificateFingerprint);
      if (signer.sha256 !== wanted) {
        failures.push(`certificate fingerprint ${signer.sha256} does not match ${wanted}`);
      }
    }
    if (expected.certificateSubject && signer.subject !== expected.certificateSubject) {
      failures.push(
        `certificate subject ${JSON.stringify(signer.subject)} does not match ${JSON.stringify(expected.certificateSubject)}`,
      );
    }
  }

  if (failures.length !== 0) {
    throw new Error(`APK_INSPECTION_FAILED: ${failures.join("; ")}.`);
  }

  return {
    packageName: badging.packageName,
    versionName: badging.versionName,
    versionCode: badging.versionCode,
    sdk: {
      min: badging.minSdk,
      compile: badging.compileSdk,
      target: badging.targetSdk,
    },
    abi: expected.abi,
    nativeLibraries: names,
    aligned: true,
    signer: signature.signers[0],
  };
}

export function buildTestKeyArguments({ keystore, alias = TEST_SIGNING_ALIAS }) {
  return [
    "-genkeypair",
    "-noprompt",
    "-storetype",
    "PKCS12",
    "-keystore",
    keystore,
    "-storepass:env",
    KEYSTORE_PASSWORD_ENV,
    "-keypass:env",
    KEY_PASSWORD_ENV,
    "-alias",
    alias,
    "-keyalg",
    "RSA",
    "-keysize",
    "4096",
    "-sigalg",
    "SHA256withRSA",
    "-validity",
    "10958",
    "-dname",
    TEST_SIGNING_SUBJECT,
  ];
}

export function buildApksignerArguments({ input, output, keystore, alias }) {
  return [
    "sign",
    "--ks",
    keystore,
    "--ks-type",
    "PKCS12",
    "--ks-key-alias",
    alias,
    "--ks-pass",
    `env:${KEYSTORE_PASSWORD_ENV}`,
    "--key-pass",
    `env:${KEY_PASSWORD_ENV}`,
    "--v4-signing-enabled",
    "false",
    "--out",
    output,
    input,
  ];
}

export function normalizeFingerprint(value) {
  const normalized = String(value).replaceAll(":", "").trim().toLowerCase();
  if (!SHA256_FINGERPRINT_PATTERN.test(normalized)) {
    throw new Error("APK_CERTIFICATE_INVALID: SHA-256 fingerprint must contain 64 hexadecimal digits.");
  }
  return normalized;
}

function compareBuildToolsVersions(left, right) {
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] !== rightParts[index]) return leftParts[index] - rightParts[index];
  }
  return 0;
}

function resolveJavaTool(name, env, platform) {
  const suffix = platform === "win32" ? ".exe" : "";
  if (env.JAVA_HOME) {
    const candidate = join(env.JAVA_HOME, "bin", `${name}${suffix}`);
    if (existsSync(candidate)) return resolve(candidate);
  }
  for (const directory of String(env.PATH ?? "").split(delimiter)) {
    if (!directory) continue;
    const candidate = join(directory, `${name}${suffix}`);
    if (existsSync(candidate)) return resolve(candidate);
  }
  throw new Error(`ANDROID_TOOLS_MISSING: ${name} was not found through JAVA_HOME or PATH.`);
}

function requireFile(path, label) {
  if (!existsSync(path)) throw new Error(`ANDROID_TOOLS_MISSING: ${label} was not found at ${path}.`);
  return resolve(path);
}

function requireAttribute(line, name, label) {
  const match = new RegExp(`${name}='([^']*)'`).exec(line);
  if (!match || match[1].length === 0) {
    throw new Error(`APK_BADGING_INVALID: ${label} is missing.`);
  }
  return match[1];
}

function requireLineValue(text, name, label) {
  const match = new RegExp(`^${name}:'([^']+)'$`, "m").exec(text);
  if (!match) throw new Error(`APK_BADGING_INVALID: ${label} is missing.`);
  return match[1];
}

function parsePositiveInteger(value, label) {
  if (!/^\d+$/.test(value)) throw new Error(`APK_BADGING_INVALID: ${label} is not an integer.`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`APK_BADGING_INVALID: ${label} must be a positive integer.`);
  }
  return parsed;
}

function compareField(failures, label, actual, expected) {
  if (actual !== expected) failures.push(`${label} ${JSON.stringify(actual)} does not match ${JSON.stringify(expected)}`);
}

function normalizeOutput(value) {
  return String(value).replace(/\r\n?/g, "\n").trim();
}

function bytewiseCompare(left, right) {
  return Buffer.from(left).compare(Buffer.from(right));
}
