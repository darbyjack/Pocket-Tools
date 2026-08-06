import { spawnSync } from "node:child_process";
import { constants as fsConstants } from "node:fs";
import { copyFile, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  assertUnsignedApkVerification,
  buildExpoPrebuildCommand,
  buildGradleCommand,
  buildPnpmCommand,
  findSingleReleaseApk,
  intermediateApkFilename,
  intermediateInspectionFilename,
  validateGeneratedGradleProperties,
  validateReleaseAbi,
  validateUnsignedApkInspection,
} from "./android-release-build-tools.mjs";
import {
  discoverAndroidTools,
  inspectNativeLibraries,
  parseAapt2Badging,
  parseJarEntries,
} from "./android-release-tools.mjs";
import { RELEASE_ABIS, sha256, stableJson, validateReleaseIdentity } from "./release-contract.mjs";

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const androidDirectory = join(repositoryRoot, "apps", "mobile", "android");
const [command, ...rawArguments] = process.argv.slice(2);
const argumentsMap = parseArguments(rawArguments);

switch (command) {
  case "build-one": {
    const tag = requiredArgument(argumentsMap, "tag");
    const abi = validateReleaseAbi(requiredArgument(argumentsMap, "abi"));
    const directory = outputDirectory(argumentsMap, tag);
    await validateSource(tag);
    const identity = await loadIdentity(tag);
    const tools = await discoverAndroidTools({
      buildToolsVersion: optionalArgument(argumentsMap, "build-tools"),
    });
    const result = await buildOne({ tag, abi, directory, identity, tools });
    process.stdout.write(stableJson(result));
    break;
  }
  case "build-all": {
    const tag = requiredArgument(argumentsMap, "tag");
    const directory = outputDirectory(argumentsMap, tag);
    await validateSource(tag);
    await assertDirectoryMissingOrEmpty(directory, "intermediate build directory");
    const identity = await loadIdentity(tag);
    const tools = await discoverAndroidTools({
      buildToolsVersion: optionalArgument(argumentsMap, "build-tools"),
    });
    const results = [];
    for (const abi of RELEASE_ABIS) {
      results.push(await buildOne({ tag, abi, directory, identity, tools }));
    }
    process.stdout.write(stableJson({ tag, sourceCommit: identity.sourceCommit, builds: results }));
    break;
  }
  default:
    throw new Error("ANDROID_BUILD_COMMAND_INVALID: use build-one or build-all.");
}

async function buildOne({ tag, abi, directory, identity, tools }) {
  await mkdir(directory, { recursive: true });
  const apkOutput = join(directory, intermediateApkFilename(tag, abi));
  const inspectionOutput = join(directory, intermediateInspectionFilename(tag, abi));
  await assertMissing(apkOutput, "intermediate APK");
  await assertMissing(inspectionOutput, "intermediate inspection report");

  const projectCacheDirectory = join(
    repositoryRoot,
    "release-work",
    "gradle-project-cache",
    identity.version,
    abi,
  );
  let completed = false;
  try {
    const probuild = buildExpoPrebuildCommand({ repositoryRoot });
    run(prebuild.executable, prebuild.args, {
      cwd: prebuild.cwd,
      env: { ...process.env, CI: "1", EXPO_NO_GIT_STATUS: "1" },
    });

    validateGeneratedGradleProperties(
      await readFile(join(androidDirectory, "gradle.properties"), "utf8"),
    );

    const gradle = buildGradleCommand({
      androidDirectory,
      abi,
      projectCacheDirectory,
      javaExecutable: tools.java,
    });
    run(gradle.executable, gradle.args, { cwd: gradle.cwd });

    const sourceApk = await findSingleReleaseApk(
      join(androidDirectory, "app", "build", "outputs", "apk", "release"),
    );
    const badging = parseAapt2Badging(run(tools.aapt2, ["dump", "badging", sourceApk]).stdout);
    const entries = parseJarEntries(run(tools.jar, ["tf", sourceApk]).stdout);
    run(tools.zipalign, ["-c", "-P", "16", "-v", "4", sourceApk]);
    const verification = run(
      tools.java,
      ["-jar", tools.apksignerJar, "verify", "--verbose", "--print-certs", "--Werr", sourceApk],
      { allowFailure: true },
    );
    assertUnsignedApkVerification(verification);

    const inspection = validateUnsignedApkInspection({
      badging,
      nativeLibraries: inspectNativeLibraries(entries),
      expected: {
        packageName: identity.packageName,
        versionName: identity.version,
        versionCode: identity.versionCode,
        abi,
      },
      aligned: true,
    });

    await copyFile(sourceApk, apkOutput, fsConstants.COPYFILE_EXCL);
    const bytes = await readFile(apkOutput);
    const report = {
      ...inspection,
      tag,
      sourceCommit: identity.sourceCommit,
      filename: intermediateApkFilename(tag, abi),
      byteSize: bytes.byteLength,
      sha256: sha256(bytes),
      buildToolsVersion: tools.buildToolsVersion,
      handoff: "unsigned-intermediate",
    };
    await writeFile(inspectionOutput, stableJson(report), {
      encoding: "utf8",
      flag: "wx",
    });
    completed = true;
    console.error(`Built and inspected unsigned ${abi} intermediate at ${apkOutput}.`);
    return report;
  } finally {
    if (completed) {
      await rm(androidDirectory, { recursive: true, force: true });
      await rm(projectCacheDirectory, { recursive: true, force: true });
    }
  }
}

async function validateSource(tag) {
  run(process.execPath, ["scripts/release-engineering.mjs", "validate-inputs", "--tag", tag]);
  runPnpm(["sync:mini-apps:check"]);
  runPnpm(["sdk:declarations:check"]);
}

function runPnpm(args) {
  const command = buildPnpmCommand(args, { repositoryRoot });
  return run(command.executable, command.args, { cwd: command.cwd });
}

async function loadIdentity(tag) {
  const rootPackage = await readJson("package.json");
  const mobilePackage = await readJson("apps/mobile/package.json");
  const appConfig = await readJson("apps/mobile/app.json");
  return validateReleaseIdentity({
    tag,
    sourceCommit: run("git", ["rev-parse", "HEAD"]).stdout.trim(),
    rootVersion: rootPackage.version,
    mobileVersion: mobilePackage.version,
    expoVersion: appConfig.expo?.version,
    versionCode: appConfig.expo?.android?.versionCode,
    packageName: appConfig.expo?.android?.package,
  });
}

function run(
  executable,
  args,
  { allowFailure = false, cwd = repositoryRoot, env = process.env } = {},
) {
  const result = spawnSync(executable, args, {
    cwd,
    encoding: "utf8",
    shell: false,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (!allowFailure && (result.error || result.status !== 0)) {
    const detail = [result.stderr, result.stdout].filter(Boolean).join("\n").trim();
    throw new Error(
      `ANDROID_BUILD_TOOL_FAILED: ${executable} ${args.join(" ")} failed${detail ? `:\n${detail}` : "."}`,
      { cause: result.error },
    );
  }
  if (result.stdout) process.stderr.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  return result;
}

async function readJson(path) {
  try {
    return JSON.parse(await readFile(resolve(repositoryRoot, path), "utf8"));
  } catch (cause) {
    throw new Error(`ANDROID_BUILD_INPUT_INVALID: unable to read ${path}.`, { cause });
  }
}

function outputDirectory(argumentsMap, tag) {
  const configured = optionalArgument(argumentsMap, "directory");
  if (configured) return resolve(repositoryRoot, configured);
  return resolve(repositoryRoot, "release-work", "intermediate", tag.slice(1));
}

async function assertMissing(path, label) {
  try {
    await stat(path);
  } catch (cause) {
    if (cause?.code === "ENOENT") return;
    throw cause;
  }
  throw new Error(`ANDROID_BUILD_OUTPUT_EXISTS: ${label} already exists at ${path}.`);
}

async function assertDirectoryMissingOrEmpty(path, label) {
  try {
    const information = await stat(path);
    if (!information.isDirectory()) {
      throw new Error(`ANDROID_BUILD_OUTPUT_INVALID: ${label} is not a directory at ${path}.`);
    }
    const entries = await import("node:fs/promises").then(({ readdir }) => readdir(path));
    if (entries.length !== 0) {
      throw new Error(`ANDROID_BUILD_OUTPUT_EXISTS: ${label} is not empty at ${path}.`);
    }
  } catch (cause) {
    if (cause?.code === "ENOENT") return;
    throw cause;
  }
}

function parseArguments(values) {
  const result = new Map();
  for (let index = 0; index < values.length; index += 1) {
    const key = values[index];
    if (!key.startsWith("--") || key.length === 2) {
      throw new Error(
        `ANDROID_BUILD_ARGUMENT_INVALID: expected --name, received ${JSON.stringify(key)}.`,
      );
    }
    const name = key.slice(2);
    const value = values[index + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`ANDROID_BUILD_ARGUMENT_INVALID: --${name} requires a value.`);
    }
    if (result.has(name)) {
      throw new Error(`ANDROID_BUILD_ARGUMENT_INVALID: --${name} was provided more than once.`);
    }
    result.set(name, value);
    index += 1;
  }
  return result;
}

function requiredArgument(argumentsMap, name) {
  const value = argumentsMap.get(name);
  if (!value) throw new Error(`ANDROID_BUILD_ARGUMENT_INVALID: --${name} is required.`);
  return value;
}

function optionalArgument(argumentsMap, name) {
  return argumentsMap.get(name);
}
