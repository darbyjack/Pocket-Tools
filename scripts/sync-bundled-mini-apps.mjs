import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import process from "node:process";

const root = resolve(import.meta.dirname, "..");
const examplesDirectory = resolve(root, "examples");
const outputPath = resolve(
  root,
  "apps/mobile/src/generated/bundled-mini-apps.json",
);

const fileNames = (await readdir(examplesDirectory))
  .filter((fileName) => fileName.endsWith(".miniapp.js"))
  .sort();

const miniApps = await Promise.all(
  fileNames.map(async (fileName) => ({
    fileName: basename(fileName),
    source: await readFile(resolve(examplesDirectory, fileName), "utf8"),
  })),
);

const output = `${JSON.stringify(miniApps, null, 2)}\n`;

if (process.argv.includes("--check")) {
  const current = await readFile(outputPath, "utf8").catch(() => "");
  if (current !== output) {
    console.error("Bundled mini-app catalog is stale. Run pnpm sync:mini-apps.");
    process.exitCode = 1;
  }
} else {
  await mkdir(resolve(outputPath, ".."), { recursive: true });
  await writeFile(outputPath, output);
}
