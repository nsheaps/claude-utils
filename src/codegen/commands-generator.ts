/**
 * Generate TypeScript command stubs and markdown commands using AST.
 *
 * For Claude Code → OpenCode: generates TypeScript command modules
 * For OpenCode → Claude Code: generates markdown commands with frontmatter
 */

import type { OpenCodeCommand } from "../core/types/open-code";
import type { ClaudeCodeCommand } from "../core/types/claude-code";
import {
  printStatements,
  createExportDefault,
  createObject,
  addLeadingComment,
  str,
  factory,
  ts,
} from "./ts-ast";

// ── OpenCode Command Stub Generator ──────────────────────────────────

/**
 * Generate a TypeScript command module using the TypeScript AST API.
 * Produces: export default { name, description, handler }
 */
export function generateCommandAST(cmd: OpenCodeCommand): string {
  const statements: ts.Statement[] = [];

  // Build properties for the export default object
  const properties: ts.ObjectLiteralElementLike[] = [];

  // name
  properties.push(
    factory.createPropertyAssignment(
      factory.createIdentifier("name"),
      str(cmd.name),
    ),
  );

  // aliases (if present)
  if (cmd.aliases && cmd.aliases.length > 0) {
    properties.push(
      factory.createPropertyAssignment(
        factory.createIdentifier("aliases"),
        factory.createArrayLiteralExpression(
          cmd.aliases.map((a) => str(a)),
          false,
        ),
      ),
    );
  }

  // description
  properties.push(
    factory.createPropertyAssignment(
      factory.createIdentifier("description"),
      str(cmd.description),
    ),
  );

  // parameters (if present)
  if (cmd.parameters && cmd.parameters.length > 0) {
    const paramElements = cmd.parameters.map((p) => {
      const paramProps: ts.ObjectLiteralElementLike[] = [
        factory.createPropertyAssignment(
          factory.createIdentifier("name"),
          str(p.name),
        ),
        factory.createPropertyAssignment(
          factory.createIdentifier("type"),
          str(p.type),
        ),
        factory.createPropertyAssignment(
          factory.createIdentifier("description"),
          str(p.description),
        ),
      ];
      if (p.required !== undefined) {
        paramProps.push(
          factory.createPropertyAssignment(
            factory.createIdentifier("required"),
            p.required ? factory.createTrue() : factory.createFalse(),
          ),
        );
      }
      return factory.createObjectLiteralExpression(paramProps, true);
    });

    properties.push(
      factory.createPropertyAssignment(
        factory.createIdentifier("parameters"),
        factory.createArrayLiteralExpression(paramElements, true),
      ),
    );
  }

  // handler — async function with typed args
  const handlerParams = [
    factory.createParameterDeclaration(
      undefined,
      undefined,
      factory.createIdentifier("args"),
      undefined,
      factory.createTypeReferenceNode(
        factory.createIdentifier("Record"),
        [
          factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
          factory.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword),
        ],
      ),
    ),
  ];

  const handlerBody = factory.createBlock([
    factory.createExpressionStatement(
      factory.createCallExpression(
        factory.createPropertyAccessExpression(
          factory.createIdentifier("console"),
          factory.createIdentifier("log"),
        ),
        undefined,
        [
          str(`Command ${cmd.name} called with:`),
          factory.createIdentifier("args"),
        ],
      ),
    ),
  ], true);

  const handlerFn = factory.createMethodDeclaration(
    [factory.createModifier(ts.SyntaxKind.AsyncKeyword)],
    undefined,
    factory.createIdentifier("handler"),
    undefined,
    undefined,
    handlerParams,
    undefined,
    handlerBody,
  );
  properties.push(handlerFn);

  // Build and export the object
  const obj = factory.createObjectLiteralExpression(properties, true);
  const exportDefault = createExportDefault(obj);

  // Add JSDoc comment
  const commented = addLeadingComment(
    exportDefault,
    `${cmd.description || cmd.name}\n *\n * Auto-generated from Claude Code plugin conversion.\n * Adapt this stub to implement the command logic.`,
    true,
  );
  statements.push(commented);

  return printStatements(statements);
}

// ── Claude Code Markdown Command Generator ───────────────────────────

/**
 * Generate a Claude Code markdown command with YAML frontmatter
 * from an OpenCode command definition.
 */
export function generateCommandMarkdown(cmd: ClaudeCodeCommand): string {
  const lines: string[] = [];

  // YAML frontmatter
  lines.push("---");
  lines.push(`name: ${cmd.name}`);
  if (cmd.aliases && cmd.aliases.length > 0) {
    lines.push(`aliases: [${cmd.aliases.join(", ")}]`);
  }
  if (cmd.description) {
    lines.push(`description: ${cmd.description}`);
  }
  if (cmd.parameters && cmd.parameters.length > 0) {
    lines.push("parameters:");
    for (const p of cmd.parameters) {
      lines.push(`  - name: ${p.name}`);
      lines.push(`    type: ${p.type}`);
      lines.push(`    description: ${p.description}`);
      if (p.required !== undefined) {
        lines.push(`    required: ${p.required}`);
      }
    }
  }
  lines.push("---");
  lines.push("");

  // Body content
  if (cmd.content) {
    lines.push(cmd.content);
  } else {
    lines.push(`# ${cmd.name}`);
    lines.push("");
    if (cmd.description) {
      lines.push(cmd.description);
      lines.push("");
    }
    lines.push("<!-- Converted from OpenCode TypeScript command -->");
  }

  return lines.join("\n");
}
