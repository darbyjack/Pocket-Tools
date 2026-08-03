import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ROOT = resolve(fileURLToPath(new URL("../../..", import.meta.url)));

test("the TypeScript CLI resolves without using a package subpath", async () => {
  const packageRoot = resolve(dirname(require.resolve("typescript")), "..");
  const manifest = JSON.parse(
    await readFile(resolve(packageRoot, "package.json"), "utf8"),
  ) as { readonly bin?: { readonly tsc?: string } };

  const tsc = manifest.bin?.tsc;
  assert.equal(typeof tsc, "string");
  if (typeof tsc !== "string") {
    throw new Error("The TypeScript package does not declare a tsc binary.");
  }

  const path = resolve(packageRoot, tsc);
  await access(path);
  assert.match(path.replaceAll("\\", "/"), /typescript\/bin\/tsc$/);
});

test("the shared TypeScript config uses TypeScript 7 path rules", async () => {
  const config = JSON.parse(
    await readFile(resolve(ROOT, "tsconfig.json"), "utf8"),
  ) as {
    readonly compilerOptions?: {
      readonly baseUrl?: unknown;
      readonly paths?: Record<string, readonly string[]>;
    };
  };

  assert.equal(config.compilerOptions?.baseUrl, undefined);
  assert.deepEqual(config.compilerOptions?.paths?.["@pocket-tools/sdk"], [
    "./packages/sdk-contract/src/index.ts",
  ]);
});
