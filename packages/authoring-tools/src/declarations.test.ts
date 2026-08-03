import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import test from "node:test";

const require = createRequire(import.meta.url);

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
