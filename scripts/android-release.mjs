import { spawnSync } from "node:child_process";
import { chmod, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  KEYSTORE_PASSWORD_ENV,
  KEY_PASSWORD_ENV,
  TEST_SIGNING_ALIAS,
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
import {
  RELEASE_ABIS,
  RELEASE_SDK_LEVELS,
  sha256,
  stableJson,
  validateReleaseIdentity,
} from "./release-contract.mjs";

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const [command, ...rawArguments] = process.argv.slice(2);
const argumentsMap = parseArguments(rawArguments);

switch (command) {
  case "tools": {
    process.stdout.write(stableJson(await loadTools(argumentsMap)));
    break;
  }
  case "test-key": {
    requirePasswordEnvironment({ requireSame: true });
    const tools = await loadTools(argumentsMap);
    const keystore = repositoryPath(requiredArgument(argumentsMap, "keystore"));
    const alias = optionalArgument(argumentsMap, "alias") ?? TEST_SIGNING_ALIAS;
    await assertMissing(keystore, "test keystore");
    await mkdir(dirname(keystore), { recursive: true });
    run(tools.keytool, buildTestKeyArguments({ keystore, alias }));
    if (process.platform !== "win32") await chmod(keystore, 0o600);
    console.log(`Created disposable PKCS#12 test key ${alias} at ${keystore}.`);
    break;
  }
  case "sign": {
    requirePasswordEnvironment();
    const tools = await loadTools(argumentsMap);
    const input = repositoryPath(requiredArgument(argumentsMap, "input"));
    const output = repositoryPath(requiredArgument(argumentsMap, "output"));
    const keystore = repositoryPath(requiredArgument(argumentsMap, "keystore"));
    const alias = requiredArgument(argumentsMap, "alias");
    await assertRegularFile(input, "input APK");
    await assertRegularFile(keystore, "keystore");
    await assertMissing(output, "signed APK output");
    await mkdir(dirname(output), { recursive: true });
    const aligned = `${output}.aligned-${process.pid}.apk`;
    try {
      run(tools.zipalign, ["-P", "16", "-f", "-v", "4", input, aligned]);
      runApksigner(tools, buildApksignerArguments({ input: aligned, output, keystore, alias }));
      runApksigner(tools, ["verify", "--verbose", "--print-certs", "--Werr", output]);
    } finally {
      await rm(aligned, { force: true });
    }
    console.log(`Aligned, signed, and verified ${output}.`);
    break;
  }
  case "inspect": {
    const tools = await loadTools(argumentsMap);
    const apk = repositoryPath(requiredArgument(argumentsMap, "apk"));
    const abi = requiredArgument(argumentsMap, "abi");
    if (!RELEASE_ABIS.includes(abi)) {
      throw new Error(`APK_ARGUMENT_INVALID: --abi must be one of ${RELEASE_ABIS.join(", ")}.`);
    }
    await assertRegularFile(apk, "APK");
    const identity = await loadReleaseIdentity(requiredArgument(argumentsMap, "tag"));
    const badging = parseAapt2Badging(run(tools.aapt2, ["dump", "badging", apk]));
    const entries = parseJarEntries(run(tools.jar, ["tf", apk]));
    run(tools.zipalign, ["-c", "-P", "16", "-v", "4", apk]);
    const signature = parseApksignerOutput(
      runApksigner(tools, ["verify", "--verbose", "--print-certs", "--Werr", apk]),
    );
    const inspection = validateApkInspection({
      badging,
      nativeLibraries: inspectNativeLibraries(entries),
      signature,
      aligned: true,
      expected: {
        packageName: identity.packageName,
        versionName: identity.version,
        versionCode: identity.versionCode,
        minSdk: RELEASE_SDK_LEVELS.min,
        compileSdk: RELEASE_SDK_LEVELS.compile,
        targetSdk: RELEASE_SDK_LEVELS.target,
        abi,
        certificateFingerprint: optionalArgument(argumentsMap, "certificate-fingerprint"),
        certificateSubject: optionalArgument(argumentsMap, "certificate-subject"),
      },
    });
    const bytes = await readFile(apk);
    const rendered = stableJson({
      ...inspection,
      filename: apk.split(/[\\/]/).at(-1),
      byteSize: bytes.byteLength,
      sha256: sha256(bytes),
      buildToolsVersion: tools.buildToolsVersion,
    });
    const output = optionalArgument(argumentsMap, "output");
    if (output) {
      const outputPath = repositoryPath(output);
      await mkdir(dirname(outputPath), { recursive: true });
      await writeFile(outputPath, rendered, "utf8");
      console.log(`Wrote APK inspection to ${outputPath}.`);
    } else {
      process.stdout.write(rendered);
    }
    break;
  }
  case "certificate": {
    const tools = await loadTools(argumentsMap);
    const apk = repositoryPath(requiredArgument(argumentsMap, "apk"));
    const output = repositoryPath(requiredArgument(argumentsMap, "output"));
    await assertRegularFile(apk, "APK");
    await assertMissing(output, "certificate output");
    const pem = extractCertificatePem(
      runApksigner(tools, ["verify", "--print-certs-pem", "--Werr", apk]),
    );
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, pem, "utf8");
    console.log(`Extracted the public APK signing certificate to ${output}.`);
    break;
  }
  default:
    throw new Error(
      "ANDROID_RELEASE_COMMAND_INVALID: use tools, test-key, sign, inspect, or certificate.",
    );
}

async function loadTools(argumentsMap) {
  return discoverAndroidTools({ buildToolsVersion: optionalArgument(argumentsMap, "build-tools") });
}

async function loadReleaseIdentity(tag) {
  const rootPackage = await readJson("package.json");
  const mobilePackage = await readJson("apps/mobile/package.json");
  const appConfig = await readJson("apps/mobile/app.json");
  return validateReleaseIdentity({
    tag,
    sourceCommit: run("git", ["rev-parse", "HEAD"]),
    rootVersion: rootPackage.version,
    mobileVersion: mobilePackage.version,
    expoVersion: appConfig.expo?.version,
    versionCode: appConfig.expo?.android?.versionCode,
    packageName: appConfig.expo?.android?.package,
  });
}

function runApksigner(tools, arguments_) {
  return run(tools.java, ["-jar", tools.apksignerJar, ...arguments_]);
}

function run(executable, arguments_) {
  const result = spawnSync(executable, arguments_, {
    cwd: repositoryRoot,
    encoding: "utf8",
    shell: false,
    env: process.env,
  });
  if (result.error || result.status !== 0) {
    const detail = [result.stderr, result.stdout].filter(Boolean).join("\n").trim();
    throw new Error(
      `ANDROID_RELEASE_TOOL_FAILED: ${executable} ${arguments_.join(" ")} failed${detail ? `: ${detail}` : "."}`,
      { cause: result.error },
    );
  }
  return result.stdout.trim();
}

function requirePasswordEnvironment({ requireSame = false } = {}) {
  for (const name of [KEYSTORE_PASSWORD_ENV, KEY_PASSWORD_ENV]) {
    if (!process.env[name]) {
      throw new Error(`ANDROID_SIGNING_INPUT_MISSING: set ${name} without printing or committing it.`);
    }
  }
  if (
    requireSame &&
    process.env[KEYSTORE_PASSWORD_ENV] !== process.env[KEY_PASSWORD_ENV]
  ) {
    throw new Error(
      "ANDROID_SIGNING_INPUT_INVALID: disposable PKCS#12 test-key generation requires matching keystore and key password values.",
    );
  }
}

async function assertRegularFile(path, label) {
  let information;
  try {
    information = await stat(path);
  } catch (cause) {
    throw new Error(`ANDROID_RELEASE_INPUT_MISSING: ${label} does not exist at ${path}.`, { cause });
  }
  if (!information.isFile()) {
    throw new Error(`ANDROID_RELEASE_INPUT_INVALID: ${label} is not a regular file at ${path}.`);
  }
}

async function assertMissing(path, label) {
  try {
    await stat(path);
  } catch (cause) {
    if (cause?.code === "ENOENT") return;
    throw cause;
  }
  throw new Error(`ANDROID_RELEASE_OUTPUT_EXISTS: ${label} already exists at ${path}.`);
}

async function readJson(path) {
  try {
    return JSON.parse(await readFile(repositoryPath(path), "utf8"));
  } catch (cause) {
    throw new Error(`ANDROID_RELEASE_INPUT_INVALID: unable to read ${path}.`, { cause });
  }
}

function repositoryPath(path) {
  return resolve(repositoryRoot, path);
}

function parseArguments(values) {
  const result = new Map();
  for (let index = 0; index < values.length; index += 1) {
    const key = values[index];
    if (!key.startsWith("--") || key.length === 2) {
      throw new Error(
        `ANDROID_RELEASE_ARGUMENT_INVALID: expected --name, received ${JSON.stringify(key)}.`,
      );
    }
    const name = key.slice(2);
    const value = values[index + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`ANDROID_RELEASE_ARGUMENT_INVALID: --${name} requires a value.`);
    }
    if (result.has(name)) {
      throw new Error(`ANDROID_RELEASE_ARGUMENT_INVALID: --${name} was provided more than once.`);
    }
    result.set(name, value);
    index += 1;
  }
  return result;
}

function requiredArgument(argumentsMap, name) {
  const value = argumentsMap.get(name);
  if (!value) throw new Error(`ANDROID_RELEASE_ARGUMENT_INVALID: --${name} is required.`);
  return value;
}

function optionalArgument(argumentsMap, name) {
  return argumentsMap.get(name);
}
