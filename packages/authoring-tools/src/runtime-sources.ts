import { readFile } from "node:fs/promises";

type HeaderName =
  | "PocketQuickJsSources.h"
  | "PocketQuickJsEverydayQueries.h"
  | "PocketQuickJsFeedback.h"
  | "PocketQuickJsNotifications.h"
  | "PocketQuickJsNotificationSnapshot.h"
  | "PocketQuickJsMultiline.h"
  | "PocketQuickJsMultiSelect.h"
  | "PocketQuickJsBadge.h"
  | "PocketQuickJsProgress.h"
  | "PocketQuickJsIcons.h";

const HEADER_ROOT = new URL("../../../modules/pocket-quickjs/android/src/main/cpp/", import.meta.url);
const RAW_STRING_END = '\n)POCKET_JS";';

export type RuntimeSourceErrorCode = "RUNTIME_SOURCE_MISSING" | "RUNTIME_SOURCE_INVALID";

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
  const headers = await readHeaders([
    "PocketQuickJsSources.h",
    "PocketQuickJsEverydayQueries.h",
    "PocketQuickJsFeedback.h",
    "PocketQuickJsNotifications.h",
    "PocketQuickJsNotificationSnapshot.h",
    "PocketQuickJsMultiline.h",
    "PocketQuickJsMultiSelect.h",
    "PocketQuickJsBadge.h",
    "PocketQuickJsProgress.h",
    "PocketQuickJsIcons.h",
  ]);

  const baseRunner = extractBaseRawString(headers["PocketQuickJsSources.h"], "kRunner");
  const everydayRunner = composeSingleRunner(
    headers["PocketQuickJsEverydayQueries.h"],
    "everydayQueryRunner",
    baseRunner,
  );
  const feedbackRunner = composeSingleRunner(
    headers["PocketQuickJsFeedback.h"],
    "feedbackRunner",
    everydayRunner,
  );
  const notificationRunner = composeSingleRunner(
    headers["PocketQuickJsNotifications.h"],
    "notificationRunner",
    feedbackRunner,
  );
  const notificationSnapshotRunner = composeRunner(
    headers["PocketQuickJsNotificationSnapshot.h"],
    "notificationSnapshotRunner",
    [notificationRunner, feedbackRunner],
  );
  const multilineRunner = composeSingleRunner(
    headers["PocketQuickJsMultiline.h"],
    "multilineRunner",
    notificationSnapshotRunner,
  );
  const multiSelectRunner = composeSingleRunner(
    headers["PocketQuickJsMultiSelect.h"],
    "multiSelectRunner",
    multilineRunner,
  );
  const badgeRunner = composeSingleRunner(
    headers["PocketQuickJsBadge.h"],
    "badgeRunner",
    multiSelectRunner,
  );
  const progressRunner = composeSingleRunner(
    headers["PocketQuickJsProgress.h"],
    "progressRunner",
    badgeRunner,
  );
  const iconRunner = composeSingleRunner(
    headers["PocketQuickJsIcons.h"],
    "iconsRunner",
    progressRunner,
  );

  let sdk = extractFunctionRawString(
    headers["PocketQuickJsMultiSelect.h"],
    "multiSelectSdk",
  );
  sdk = insertAfter(
    sdk,
    '  summary: (definition) => typed("summary", definition),\n',
    '  badge: (definition) => typed("badge", definition),\n',
    "badgeSdk",
  );
  sdk = insertAfter(
    sdk,
    '  badge: (definition) => typed("badge", definition),\n',
    '  progress: (definition) => typed("progress", definition),\n',
    "progressSdk",
  );

  return { sdk, runner: iconRunner };
}

async function readHeaders<const TNames extends readonly HeaderName[]>(
  names: TNames,
): Promise<{ readonly [TName in TNames[number]]: string }> {
  const entries = await Promise.all(
    names.map(async (name) => [name, await readHeader(name)] as const),
  );
  return Object.fromEntries(entries) as { readonly [TName in TNames[number]]: string };
}

async function readHeader(name: HeaderName): Promise<string> {
  try {
    return (await readFile(new URL(name, HEADER_ROOT), "utf8")).replaceAll("\r\n", "\n");
  } catch (caught) {
    throw new RuntimeSourceError(
      "RUNTIME_SOURCE_MISSING",
      caught instanceof Error ? `Unable to read ${name}: ${caught.message}` : `Unable to read ${name}.`,
    );
  }
}

function extractBaseRawString(header: string, name: string): string {
  const startMarker = `inline constexpr char ${name}[] = R"POCKET_JS(\n`;
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

function extractFunctionRawString(header: string, functionName: string): string {
  const fragments = extractFunctionRawFragments(header, functionName);
  if (fragments.length !== 1) {
    throw new RuntimeSourceError(
      "RUNTIME_SOURCE_INVALID",
      `${functionName} must contain exactly one JavaScript raw string.`,
    );
  }
  return fragments[0]!;
}

function composeSingleRunner(header: string, functionName: string, dependency: string): string {
  return composeRunner(header, functionName, [dependency]);
}

function composeRunner(
  header: string,
  functionName: string,
  dependencies: readonly string[],
): string {
  const fragments = extractFunctionRawFragments(header, functionName);
  if (fragments.length !== dependencies.length + 1) {
    throw new RuntimeSourceError(
      "RUNTIME_SOURCE_INVALID",
      `${functionName} must contain ${dependencies.length + 1} JavaScript raw-string fragments.`,
    );
  }

  let result = fragments[0]!;
  for (const [index, dependency] of dependencies.entries()) {
    result += dependency + fragments[index + 1]!;
  }
  return result;
}

function extractFunctionRawFragments(header: string, functionName: string): readonly string[] {
  const marker = `inline const char* ${functionName}()`;
  const start = header.indexOf(marker);
  if (start < 0) {
    throw new RuntimeSourceError("RUNTIME_SOURCE_MISSING", `${functionName} was not found.`);
  }
  const end = header.indexOf("return source.c_str();", start);
  if (end < 0) {
    throw new RuntimeSourceError(
      "RUNTIME_SOURCE_INVALID",
      `${functionName} is missing its source return.`,
    );
  }

  const body = header.slice(start, end);
  const fragments: string[] = [];
  const pattern = /R"POCKET_JS\(\n([\s\S]*?)\n\)POCKET_JS"/g;
  for (const match of body.matchAll(pattern)) fragments.push(match[1]!);
  if (fragments.length === 0) {
    throw new RuntimeSourceError(
      "RUNTIME_SOURCE_MISSING",
      `${functionName} does not contain JavaScript source.`,
    );
  }
  return fragments;
}

function insertAfter(
  source: string,
  marker: string,
  insertion: string,
  sourceName: string,
): string {
  const position = source.indexOf(marker);
  if (position < 0) {
    throw new RuntimeSourceError(
      "RUNTIME_SOURCE_INVALID",
      `${sourceName} could not find its SDK insertion marker.`,
    );
  }
  return source.slice(0, position + marker.length) + insertion + source.slice(position + marker.length);
}
