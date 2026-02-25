/**
 * Generate OpenCode hooks plugin files using TypeScript AST.
 *
 * Produces properly structured TypeScript that registers event handlers
 * corresponding to Claude Code hooks. Unlike string concatenation, this
 * uses the TypeScript compiler API to build a valid AST, ensuring
 * syntactically correct output.
 */

import type { OpenCodeHookConfig } from "../core/types/open-code";
import type { ClaudeCodeHooks, ClaudeCodeHookMatcher } from "../core/types/claude-code";
import { HOOK_EVENT_MAPPINGS } from "../core/types/common";
import {
  printStatements,
  createTypeImport,
  createExportedConst,
  createAsyncArrow,
  createDestructuredParam,
  createChainedCall,
  createAwait,
  createReturn,
  createObject,
  createConst,
  emptyObject,
  str,
  id,
  addLeadingComment,
  factory,
  ts,
} from "./ts-ast";

// ── Event Mapping ────────────────────────────────────────────────────

const OPENCODE_EVENT_MAP: Record<string, string> = {
  beforeTool: "tool.execute.before",
  afterTool: "tool.execute.after",
  afterToolError: "session.error",
  sessionStart: "session.created",
  sessionEnd: "session.deleted",
  idle: "session.idle",
  permissionCheck: "permission.asked",
  notification: "tui.toast.show",
  beforePrompt: "tui.prompt.append",
  beforeCompact: "context.compact.before",
  afterCompact: "context.compact.after",
  taskComplete: "task.complete",
};

// ── OpenCode Hooks Plugin Generator ──────────────────────────────────

/**
 * Generate a complete OpenCode hooks plugin TypeScript file from
 * OpenCodeHookConfig entries using the TypeScript AST API.
 */
export function generateHooksPluginAST(hooks: OpenCodeHookConfig[]): string {
  const statements: ts.Statement[] = [];

  // Import statement
  statements.push(
    createTypeImport("@opencode-ai/plugin", ["PluginContext"]),
  );

  // Build event subscription statements
  const bodyStatements: ts.Statement[] = [];

  for (const hook of hooks) {
    const sseEvent = OPENCODE_EVENT_MAP[hook.event] || hook.event;

    if (hook.command) {
      // Shell command handler
      const handlerBody = buildShellCommandHandler(hook.command);
      const subscribeCall = buildSubscribeCall(sseEvent, handlerBody);
      const stmt = factory.createExpressionStatement(subscribeCall);
      bodyStatements.push(
        addLeadingComment(stmt, `${hook.event}: ${hook.command}`),
      );
    } else if (hook.handler && hook.handler !== "(inline plugin handler)") {
      // Dynamic import handler
      const handlerBody = buildDynamicImportHandler(hook.handler);
      const subscribeCall = buildSubscribeCall(sseEvent, handlerBody);
      const stmt = factory.createExpressionStatement(subscribeCall);
      bodyStatements.push(
        addLeadingComment(stmt, `${hook.event}: ${hook.handler}`),
      );
    }
  }

  // Return empty object
  bodyStatements.push(createReturn(emptyObject()));

  // Build the plugin function
  const pluginFn = createAsyncArrow(
    [createDestructuredParam(["client"], "PluginContext")],
    bodyStatements,
  );

  // Export const HooksPlugin = async ({ client }: PluginContext) => { ... }
  const pluginDecl = createExportedConst("HooksPlugin", pluginFn);
  statements.push(
    addLeadingComment(
      pluginDecl,
      "Hooks plugin - auto-generated from Claude Code plugin conversion.\n * Review and adapt each handler for OpenCode's event system.",
      true,
    ),
  );

  // export default HooksPlugin;
  statements.push(
    factory.createExportAssignment(undefined, false, id("HooksPlugin")),
  );

  return printStatements(statements);
}

/**
 * Generate a Claude Code hooks/hooks.json from OpenCode hooks using
 * programmatic JSON construction.
 */
export function generateHooksJSON(hooks: ClaudeCodeHooks): string {
  return JSON.stringify({ hooks }, null, 2) + "\n";
}

// ── AST Helpers ──────────────────────────────────────────────────────

function buildSubscribeCall(
  event: string,
  handlerBody: ts.Statement[],
): ts.Expression {
  const handlerFn = factory.createArrowFunction(
    [factory.createModifier(ts.SyntaxKind.AsyncKeyword)],
    undefined,
    [factory.createParameterDeclaration(
      undefined,
      undefined,
      id("event"),
    )],
    undefined,
    factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
    factory.createBlock(handlerBody, true),
  );

  return createChainedCall(
    ["client", "event", "subscribe"],
    [str(event), handlerFn],
  );
}

function buildShellCommandHandler(command: string): ts.Statement[] {
  // const { execSync } = await import("child_process");
  const importExpr = createAwait(
    factory.createCallExpression(
      factory.createToken(ts.SyntaxKind.ImportKeyword) as unknown as ts.Expression,
      undefined,
      [str("child_process")],
    ),
  );

  // Use dynamic import with destructuring
  const importDecl = factory.createVariableStatement(
    undefined,
    factory.createVariableDeclarationList(
      [factory.createVariableDeclaration(
        factory.createObjectBindingPattern([
          factory.createBindingElement(undefined, undefined, id("execSync")),
        ]),
        undefined,
        undefined,
        importExpr,
      )],
      ts.NodeFlags.Const,
    ),
  );

  // execSync(command, { env: { ...process.env, OPENCODE_EVENT: JSON.stringify(event) }, stdio: "pipe" })
  const execCall = factory.createExpressionStatement(
    factory.createCallExpression(
      id("execSync"),
      undefined,
      [
        str(command),
        factory.createObjectLiteralExpression([
          factory.createPropertyAssignment(
            id("env"),
            factory.createObjectLiteralExpression([
              factory.createSpreadAssignment(
                factory.createPropertyAccessExpression(id("process"), id("env")),
              ),
              factory.createPropertyAssignment(
                id("OPENCODE_EVENT"),
                factory.createCallExpression(
                  factory.createPropertyAccessExpression(id("JSON"), id("stringify")),
                  undefined,
                  [id("event")],
                ),
              ),
            ], true),
          ),
          factory.createPropertyAssignment(id("stdio"), str("pipe")),
        ], true),
      ],
    ),
  );

  return [importDecl, execCall];
}

function buildDynamicImportHandler(handlerPath: string): ts.Statement[] {
  // const handler = await import(handlerPath);
  const importExpr = createAwait(
    factory.createCallExpression(
      factory.createToken(ts.SyntaxKind.ImportKeyword) as unknown as ts.Expression,
      undefined,
      [str(handlerPath)],
    ),
  );

  const importDecl = createConst("handler", importExpr);

  // await handler.default(event);
  const callStmt = factory.createExpressionStatement(
    createAwait(
      factory.createCallExpression(
        factory.createPropertyAccessExpression(id("handler"), id("default")),
        undefined,
        [id("event")],
      ),
    ),
  );

  return [importDecl, callStmt];
}
