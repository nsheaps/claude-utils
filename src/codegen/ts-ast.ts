/**
 * TypeScript AST helper utilities for programmatic code generation.
 *
 * Wraps the TypeScript compiler API to provide a simpler interface for
 * building common AST patterns used in plugin conversion.
 */

import ts from "typescript";

const factory = ts.factory;

// ── Printing ─────────────────────────────────────────────────────────

const printer = ts.createPrinter({
  newLine: ts.NewLineKind.LineFeed,
  removeComments: false,
});

/**
 * Print an array of statements as a complete TypeScript source file.
 */
export function printStatements(statements: ts.Statement[]): string {
  const sourceFile = ts.createSourceFile(
    "output.ts",
    "",
    ts.ScriptTarget.Latest,
    false,
    ts.ScriptKind.TS,
  );

  const file = factory.updateSourceFile(sourceFile, statements);
  return printer.printFile(file);
}

/**
 * Print a single AST node to string.
 */
export function printNode(node: ts.Node): string {
  const sourceFile = ts.createSourceFile(
    "output.ts",
    "",
    ts.ScriptTarget.Latest,
    false,
    ts.ScriptKind.TS,
  );
  return printer.printNode(ts.EmitHint.Unspecified, node, sourceFile);
}

// ── Import Declarations ──────────────────────────────────────────────

/**
 * Create an import declaration: `import { a, b } from "module";`
 */
export function createNamedImport(
  moduleSpecifier: string,
  namedImports: string[],
  typeOnly = false,
): ts.ImportDeclaration {
  return factory.createImportDeclaration(
    undefined,
    factory.createImportClause(
      typeOnly,
      undefined,
      factory.createNamedImports(
        namedImports.map((name) =>
          factory.createImportSpecifier(false, undefined, factory.createIdentifier(name)),
        ),
      ),
    ),
    factory.createStringLiteral(moduleSpecifier),
  );
}

/**
 * Create a type-only import: `import type { A } from "module";`
 */
export function createTypeImport(
  moduleSpecifier: string,
  namedImports: string[],
): ts.ImportDeclaration {
  return createNamedImport(moduleSpecifier, namedImports, true);
}

// ── Variable Declarations ────────────────────────────────────────────

/**
 * Create a const declaration: `const name = initializer;`
 */
export function createConst(
  name: string,
  initializer: ts.Expression,
  type?: ts.TypeNode,
): ts.VariableStatement {
  return factory.createVariableStatement(
    undefined,
    factory.createVariableDeclarationList(
      [factory.createVariableDeclaration(
        factory.createIdentifier(name),
        undefined,
        type,
        initializer,
      )],
      ts.NodeFlags.Const,
    ),
  );
}

/**
 * Create an exported const: `export const name = initializer;`
 */
export function createExportedConst(
  name: string,
  initializer: ts.Expression,
  type?: ts.TypeNode,
): ts.VariableStatement {
  return factory.createVariableStatement(
    [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
    factory.createVariableDeclarationList(
      [factory.createVariableDeclaration(
        factory.createIdentifier(name),
        undefined,
        type,
        initializer,
      )],
      ts.NodeFlags.Const,
    ),
  );
}

// ── Function/Arrow Building ──────────────────────────────────────────

/**
 * Create an async arrow function: `async (params) => { ...body }`
 */
export function createAsyncArrow(
  params: ts.ParameterDeclaration[],
  body: ts.Statement[],
): ts.ArrowFunction {
  return factory.createArrowFunction(
    [factory.createModifier(ts.SyntaxKind.AsyncKeyword)],
    undefined,
    params,
    undefined,
    factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
    factory.createBlock(body, true),
  );
}

/**
 * Create a parameter with destructured type: `{ client }: PluginContext`
 */
export function createDestructuredParam(
  properties: string[],
  typeName: string,
): ts.ParameterDeclaration {
  return factory.createParameterDeclaration(
    undefined,
    undefined,
    factory.createObjectBindingPattern(
      properties.map((prop) =>
        factory.createBindingElement(undefined, undefined, factory.createIdentifier(prop)),
      ),
    ),
    undefined,
    factory.createTypeReferenceNode(factory.createIdentifier(typeName)),
  );
}

/**
 * Create a simple parameter: `name: type`
 */
export function createParam(
  name: string,
  typeName: string,
): ts.ParameterDeclaration {
  return factory.createParameterDeclaration(
    undefined,
    undefined,
    factory.createIdentifier(name),
    undefined,
    factory.createTypeReferenceNode(factory.createIdentifier(typeName)),
  );
}

// ── Expression Builders ──────────────────────────────────────────────

/**
 * Create a method call: `obj.method(args)`
 */
export function createMethodCall(
  obj: string,
  method: string,
  args: ts.Expression[],
): ts.CallExpression {
  return factory.createCallExpression(
    factory.createPropertyAccessExpression(
      factory.createIdentifier(obj),
      factory.createIdentifier(method),
    ),
    undefined,
    args,
  );
}

/**
 * Create a chained property access and method call: `a.b.c(args)`
 */
export function createChainedCall(
  parts: string[],
  args: ts.Expression[],
): ts.CallExpression {
  let expr: ts.Expression = factory.createIdentifier(parts[0]);
  for (let i = 1; i < parts.length - 1; i++) {
    expr = factory.createPropertyAccessExpression(expr, factory.createIdentifier(parts[i]));
  }
  return factory.createCallExpression(
    factory.createPropertyAccessExpression(expr, factory.createIdentifier(parts[parts.length - 1])),
    undefined,
    args,
  );
}

/**
 * Create an await expression: `await expr`
 */
export function createAwait(expr: ts.Expression): ts.AwaitExpression {
  return factory.createAwaitExpression(expr);
}

/**
 * Create a string literal.
 */
export function str(value: string): ts.StringLiteral {
  return factory.createStringLiteral(value);
}

/**
 * Create an identifier.
 */
export function id(name: string): ts.Identifier {
  return factory.createIdentifier(name);
}

/**
 * Create an object literal: `{ key: value, ... }`
 */
export function createObject(
  properties: Array<[string, ts.Expression]>,
): ts.ObjectLiteralExpression {
  return factory.createObjectLiteralExpression(
    properties.map(([key, value]) =>
      factory.createPropertyAssignment(factory.createIdentifier(key), value),
    ),
    true,
  );
}

/**
 * Create a spread assignment: `...expr`
 */
export function createSpread(expr: ts.Expression): ts.SpreadAssignment {
  return factory.createSpreadAssignment(expr);
}

// ── Comment Helpers ──────────────────────────────────────────────────

/**
 * Add a leading comment to a statement.
 */
export function addLeadingComment<T extends ts.Node>(
  node: T,
  text: string,
  multiline = false,
): T {
  return ts.addSyntheticLeadingComment(
    node,
    multiline ? ts.SyntaxKind.MultiLineCommentTrivia : ts.SyntaxKind.SingleLineCommentTrivia,
    multiline ? `*\n * ${text}\n ` : ` ${text}`,
    true,
  );
}

// ── Export/Default Helpers ────────────────────────────────────────────

/**
 * Create `export default expr;`
 */
export function createExportDefault(expr: ts.Expression): ts.ExportAssignment {
  return factory.createExportAssignment(undefined, false, expr);
}

/**
 * Create a return statement: `return expr;`
 */
export function createReturn(expr: ts.Expression): ts.ReturnStatement {
  return factory.createReturnStatement(expr);
}

/**
 * Create an empty object literal: `{}`
 */
export function emptyObject(): ts.ObjectLiteralExpression {
  return factory.createObjectLiteralExpression([], false);
}

// Re-export the factory for advanced usage
export { factory, ts };
