import { execFile } from "node:child_process";
import {
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const executeFile = promisify(execFile);
const ROOT = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const PROJECT = resolve(ROOT, "packages/sdk-contract/tsconfig.declarations.json");
const OUTPUT = resolve(ROOT, "packages/sdk-contract/dist");

async function main(): Promise<void> {
  const mode = process.argv[2];
  if (mode !== "write" && mode !== "check") {
    throw new Error("Usage: declarations.ts <write|check>");
  }

  if (mode === "write") {
    await rm(OUTPUT, { force: true, recursive: true });
    await emitDeclarations(OUTPUT);
    process.stdout.write("Generated packages/sdk-contract/dist declarations.\n");
    return;
  }

  const temporaryRoot = await mkdtemp(resolve(tmpdir(), "pocket-tools-sdk-"));
  const temporaryOutput = resolve(temporaryRoot, "dist");
  try {
    await emitDeclarations(temporaryOutput);
    const differences = await compareDirectories(OUTPUT, temporaryOutput);
    if (differences.length > 0) {
      throw new Error(
        `SDK declarations are stale:\n${differences.map((entry) => `- ${entry}`).join("\n")}\nRun pnpm sdk:declarations.`,
      );
    }
  } finally {
    await rm(temporaryRoot, { force: true, recursive: true });
  }
}

async function emitDeclarations(output: string): Promise<void> {
  await executeFile(
    process.platform === "win32" ? "tsc.cmd" : "tsc",
    ["--project", PROJECT, "--outDir", output],
    { cwd: ROOT },
  );
  await rewriteDeclarationImports(output);
}

async function rewriteDeclarationImports(directory: string): Promise<void> {
  for (const file of await listFiles(directory)) {
    if (!file.endsWith(".d.ts")) continue;
    const path = resolve(directory, file);
    const content = await readFile(path, "utf8");
    const rewritten = content.replace(
      /(["']\.[^"']+)\.ts(["'])/g,
      "$1.js$2",
    );
    if (rewritten !== content) await writeFile(path, rewritten, "utf8");
  }
}

async function compareDirectories(left: string, right: string): Promise<readonly string[]> {
  const leftFiles = await listFiles(left);
  const rightFiles = await listFiles(right);
  const allFiles = new Set([...leftFiles, ...rightFiles]);
  const differences: string[] = [];

  for (const file of [...allFiles].sort()) {
    if (!leftFiles.includes(file) || !rightFiles.includes(file)) {
      differences.push(file);
      continue;
    }
    const [leftContent, rightContent] = await Promise.all([
      readFile(resolve(left, file), "utf8"),
      readFile(resolve(right, file), "utf8"),
    ]);
    if (normalizeDeclaration(leftContent) !== normalizeDeclaration(rightContent)) {
      differences.push(file);
    }
  }
  return differences;
}

function normalizeDeclaration(value: string): string {
  return value.replace(/\s+/g, "");
}

async function listFiles(directory: string, prefix = ""): Promise<readonly string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const relative = prefix.length === 0 ? entry.name : `${prefix}/${entry.name}`;
    if (entry.isDirectory()) {
      files.push(...(await listFiles(resolve(directory, entry.name), relative)));
    } else if (entry.isFile()) {
      files.push(relative);
    }
  }
  return files;
}

await main();
