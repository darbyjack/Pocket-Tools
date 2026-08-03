import * as ts from "typescript";

const SDK_MODULE = "@pocket-tools/sdk";

export interface ImportViolation {
  readonly moduleName: string;
  readonly line: number;
  readonly column: number;
  readonly message: string;
}

export function findImportViolation(source: string): ImportViolation | null {
  const sourceFile = ts.createSourceFile(
    "pocket-mini-app.mjs",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  let violation: ImportViolation | null = null;

  const visit = (node: ts.Node): void => {
    if (violation !== null) return;

    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier !== undefined
    ) {
      const moduleName = stringModuleName(node.moduleSpecifier);
      if (moduleName === null || moduleName !== SDK_MODULE) {
        violation = createViolation(
          sourceFile,
          node.moduleSpecifier,
          moduleName ?? "<non-literal module>",
          moduleName === null
            ? "Module specifiers must be string literals."
            : `Unsupported module: ${moduleName}`,
        );
        return;
      }
    }

    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword
    ) {
      const argument = node.arguments[0];
      violation = createViolation(
        sourceFile,
        argument ?? node,
        argument === undefined ? "<missing dynamic import>" : argument.getText(sourceFile),
        "Dynamic imports are unsupported.",
      );
      return;
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return violation;
}

function stringModuleName(node: ts.Expression): string | null {
  return ts.isStringLiteralLike(node) ? node.text : null;
}

function createViolation(
  sourceFile: ts.SourceFile,
  node: ts.Node,
  moduleName: string,
  message: string,
): ImportViolation {
  const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return {
    moduleName,
    line: position.line + 1,
    column: position.character + 1,
    message,
  };
}
