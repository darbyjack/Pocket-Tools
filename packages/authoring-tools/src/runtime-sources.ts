import { readFile } from "node:fs/promises";

const HEADER_URL = new URL(
  "../../../modules/pocket-quickjs/android/src/main/cpp/PocketQuickJsSources.h",
  import.meta.url,
);
const RAW_STRING_END = "\n)POCKET_JS\";";

export type RuntimeSourceErrorCode =
  | "RUNTIME_SOURCE_MISSING"
  | "RUNTIME_SOURCE_INVALID";

export class RuntimeSourceError extends Error {
  readonly code: RuntimeSourceErrorCode;

  constructor(code: RuntimeSourceErrorCode, message: string) {
    super(message);
    this.name = "RuntimeSourceError";
    this.code = code;
  }
}

export interface EmbeddedRuntimeSources {
  readonly sdk: string;
  readonly runner: string;
}

export async function readEmbeddedRuntimeSources(): Promise<EmbeddedRuntimeSources> {
  let header: string;
  try {
    header = await readFile(HEADER_URL, "utf8");
  } catch (caught) {
    throw new RuntimeSourceError(
      "RUNTIME_SOURCE_MISSING",
      caught instanceof Error
        ? `Unable to read PocketQuickJsSources.h: ${caught.message}`
        : "Unable to read PocketQuickJsSources.h.",
    );
  }
  const normalizedHeader = header.replaceAll("\r\n", "\n");
  return {
    sdk: extractRawString(normalizedHeader, "kSdk"),
    runner: extractRawString(normalizedHeader, "kRunner"),
  };
}

function extractRawString(header: string, name: string): string {
  const startMarker = `inline constexpr char ${name}[] = R\"POCKET_JS(\n`;
  const start = header.indexOf(startMarker);
  if (start < 0) {
    throw new RuntimeSourceError(
      "RUNTIME_SOURCE_MISSING",
      `${name} was not found in PocketQuickJsSources.h.`,
    );
  }

  const contentStart = start + startMarker.length;
  const end = header.indexOf(RAW_STRING_END, contentStart);
  if (end < 0) {
    throw new RuntimeSourceError(
      "RUNTIME_SOURCE_INVALID",
      `${name} is missing its raw-string terminator.`,
    );
  }

  return header.slice(contentStart, end);
}
