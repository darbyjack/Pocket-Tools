import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import * as ts from "typescript";

const ROOT = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const DEFAULT_FILE = resolve(ROOT, "pocket-mini-app.mjs");

export interface AuthoringTypecheckIssue {
  readonly code: number;
  readonly file: string;
  readonly line: number;
  readonly column: number;
  readonly message: string;
}

export class AuthoringTypecheckError extends Error {
  readonly code = "TYPECHECK_FAILED" as const;
  readonly issues: readonly AuthoringTypecheckIssue[];

  constructor(issues: readonly AuthoringTypecheckIssue[]) {
    super(
      issues
        .map(
          (issue) =>
            `${issue.file}:${issue.line}:${issue.column} TS${issue.code}: ${issue.message}`,
        )
        .join("\n"),
    );
    this.name = "AuthoringTypecheckError";
    this.issues = issues;
  }
}

export function assertMiniAppTypeChecks(
  source: string,
  fileName = DEFAULT_FILE,
): void {
  const sourcePath = resolve(fileName);
  const options: ts.CompilerOptions = {
    allowJs: true,
    checkJs: true,
    exactOptionalPropertyTypes: true,
    forceConsistentCasingInFileNames: true,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    noEmit: true,
    noFallthroughCasesInSwitch: true,
    noImplicitOverride: true,
    noUncheckedIndexedAccess: true,
    noUnusedLocals: true,
    noUnusedParameters: true,
    paths: {
      "@pocket-tools/sdk": ["packages/sdk-contract/dist/index.d.ts"],
    },
    baseUrl: ROOT,
    skipLibCheck: true,
    strict: true,
    target: ts.ScriptTarget.ESNext,
    types: [],
  };
  const host = ts.createCompilerHost(options, true);
  const originalFileExists = host.fileExists.bind(host);
  const originalReadFile = host.readFile.bind(host);
  const originalGetSourceFile = host.getSourceFile.bind(host);

  host.fileExists = (candidate) =>
    samePath(candidate, sourcePath) || originalFileExists(candidate);
  host.readFile = (candidate) =>
    samePath(candidate, sourcePath) ? source : originalReadFile(candidate);
  host.getSourceFile = (
    candidate,
    languageVersion,
    onError,
    shouldCreateNewSourceFile,
  ) =>
    samePath(candidate, sourcePath)
      ? ts.createSourceFile(
          sourcePath,
          source,
          languageVersion,
          true,
          ts.ScriptKind.JS,
        )
      : originalGetSourceFile(
          candidate,
          languageVersion,
          onError,
          shouldCreateNewSourceFile,
        );

  const program = ts.createProgram({
    rootNames: [sourcePath],
    options,
    host,
  });
  const issues = ts
    .getPreEmitDiagnostics(program)
    .filter(
      (diagnostic) =>
        diagnostic.category === ts.DiagnosticCategory.Error &&
        (diagnostic.file === undefined ||
          samePath(diagnostic.file.fileName, sourcePath)),
    )
    .map((diagnostic): AuthoringTypecheckIssue => {
      const position =
        diagnostic.file === undefined || diagnostic.start === undefined
          ? { line: 0, character: 0 }
          : diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
      return {
        code: diagnostic.code,
        file: sourcePath,
        line: position.line + 1,
        column: position.character + 1,
        message: ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
      };
    });

  if (issues.length > 0) throw new AuthoringTypecheckError(issues);
}

function samePath(left: string, right: string): boolean {
  const normalizedLeft = normalizePath(left);
  const normalizedRight = normalizePath(right);
  return normalizedLeft === normalizedRight;
}

function normalizePath(value: string): string {
  const normalized = resolve(value).replaceAll("\\", "/");
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}
