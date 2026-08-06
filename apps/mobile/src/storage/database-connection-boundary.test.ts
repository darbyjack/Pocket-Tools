import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const sourceRoot = dirname(dirname(fileURLToPath(import.meta.url)));

test("only the migrated connection module opens the application database", async () => {
  const sourceFiles = await listProductionSourceFiles(sourceRoot);
  const directOpeners: string[] = [];

  for (const path of sourceFiles) {
    const source = await readFile(path, "utf8");
    if (source.includes('openDatabaseAsync("pocket-tools.db")')) {
      directOpeners.push(relative(sourceRoot, path).replaceAll("\\", "/"));
    }
  }

  assert.deepEqual(directOpeners.sort(), ["storage/database-connection.ts"]);
});

test("the legacy initializer no longer creates schema objects", async () => {
  const source = await readFile(join(sourceRoot, "storage", "database.ts"), "utf8");

  assert.doesNotMatch(source, /CREATE\s+(?:TABLE|INDEX)/i);
  assert.match(source, /getDatabase/);
});

async function listProductionSourceFiles(directory: string): Promise<readonly string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return listProductionSourceFiles(path);
      if (
        entry.isFile() &&
        /\.(?:ts|tsx)$/.test(entry.name) &&
        !/\.test\.(?:ts|tsx)$/.test(entry.name)
      ) {
        return [path];
      }
      return [];
    }),
  );
  return files.flat();
}
