import assert from "node:assert/strict";
import test from "node:test";

import { classifyPaths, githubOutputs } from "./ci-paths.mjs";

test("classifies documentation-only changes without Android work", () => {
  assert.deepEqual(
    classifyPaths(["README.md", "docs/SDK_OVERVIEW.md", "apps/docs/astro.config.mjs"]),
    {
      abis: [],
      android: false,
      docsOnly: true,
      native: false,
      paths: ["README.md", "apps/docs/astro.config.mjs", "docs/SDK_OVERVIEW.md"],
    },
  );
});

test("classifies ordinary mobile changes for ARM64 smoke coverage", () => {
  assert.deepEqual(classifyPaths(["apps/mobile/src/runtime/runner.ts"]), {
    abis: ["arm64-v8a"],
    android: true,
    docsOnly: false,
    native: false,
    paths: ["apps/mobile/src/runtime/runner.ts"],
  });
});

test("escalates native and dependency changes to ARM64 and x86_64", () => {
  const native = classifyPaths([
    "modules/pocket-quickjs/android/src/main/cpp/runtime.cpp",
    "pnpm-lock.yaml",
  ]);
  assert.equal(native.android, true);
  assert.equal(native.native, true);
  assert.deepEqual(native.abis, ["arm64-v8a", "x86_64"]);
});

test("treats Android workflow changes as native smoke coverage", () => {
  const result = classifyPaths([".github/workflows/ci.yml"]);
  assert.equal(result.android, true);
  assert.equal(result.native, true);
  assert.deepEqual(result.abis, ["arm64-v8a", "x86_64"]);
});

test("normalizes Windows separators and removes duplicate paths", () => {
  assert.deepEqual(classifyPaths([".\\apps\\mobile\\app.json", "apps/mobile/app.json"]).paths, [
    "apps/mobile/app.json",
  ]);
});

test("serializes stable GitHub job outputs", () => {
  assert.equal(
    githubOutputs(classifyPaths(["apps/mobile/src/App.tsx"])),
    [
      'abis=["arm64-v8a"]',
      "android=true",
      "docs_only=false",
      "native=false",
      'paths=["apps/mobile/src/App.tsx"]',
    ].join("\n"),
  );
});
