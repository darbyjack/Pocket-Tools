import { readFile } from "node:fs/promises";

const HEADER_URL = new URL(
  "../../../modules/pocket-quickjs/android/src/main/cpp/PocketQuickJsSources.h",
  import.meta.url,
);
const RAW_STRING_END = "\n)POCKET_JS\";";

export interface EmbeddedRuntimeSources {
  readonly sdk: string;
  readonly runner: string;
}

export async function readEmbeddedRuntimeSources(): Promise<EmbeddedRuntimeSources> {
  const header = await readFile(HEADER_URL, "utf8");
  return {
    sdk: extractRawString(header, "kSdk"),
    runner: extractRawString(header, "kRunner"),
  };
}

function extractRawString(header: string, name: string): string {
  const startMarker = `inline constexpr char ${name}[] = R\"POCKET_JS(\n`;
  const start = header.indexOf(startMarker);
  if (start < 0) {
    throw new Error(`RUNTIME_SOURCE_MISSING: ${name} was not found in PocketQuickJsSources.h.`);
  }

  const contentStart = start + startMarker.length;
  const end = header.indexOf(RAW_STRING_END, contentStart);
  if (end < 0) {
    throw new Error(`RUNTIME_SOURCE_INVALID: ${name} is missing its raw-string terminator.`);
  }

  return header.slice(contentStart, end);
}
