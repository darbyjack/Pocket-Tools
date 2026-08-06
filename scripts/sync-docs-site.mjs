import {
  compareDirectories,
  generateDocumentation,
  generatedDocsDir,
} from "./docs-lib.mjs";
import { normalizeGeneratedDocumentation } from "./docs-output.mjs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const mode = process.argv[2] ?? "write";

if (mode === "write") {
  const manifest = await generateDocumentation(generatedDocsDir);
  await normalizeGeneratedDocumentation(generatedDocsDir);
  console.log(
    `Generated ${manifest.entries.length} documentation pages in ${generatedDocsDir}.`,
  );
} else if (mode === "check") {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "pocket-tools-docs-check-"));
  const first = join(temporaryRoot, "first");
  const second = join(temporaryRoot, "second");

  try {
    const firstManifest = await generateDocumentation(first);
    await normalizeGeneratedDocumentation(first);
    await generateDocumentation(second);
    await normalizeGeneratedDocumentation(second);
    await compareDirectories(first, second);
    console.log(
      `Documentation generation is deterministic for ${firstManifest.entries.length} pages.`,
    );
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
} else {
  throw new Error(`Unknown documentation sync mode: ${mode}`);
}
