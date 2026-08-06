import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const storageRoot = new URL("./", import.meta.url);

test("portable restores enter through the version-dispatched reader", async () => {
  const source = await readFile(new URL("backup-storage.ts", storageRoot), "utf8");

  assert.match(source, /const parsed = readPortableMiniAppBackup\(backup\)/);
  assert.doesNotMatch(source, /const parsed = parseMiniAppBackup\(backup\)/);
});

test("host restores enter through the version-dispatched reader", async () => {
  const source = await readFile(new URL("host-backup-storage.ts", storageRoot), "utf8");

  assert.match(source, /const backup = readCompleteHostBackup\(input\)/);
  assert.match(source, /const backup = readCompleteHostBackup\(prepared\.backup\)/);
  assert.doesNotMatch(source, /const backup = parseHostBackup\((?:input|prepared\.backup)\)/);
});
