/**
 * Type declarations for optional SDKs that may not be installed.
 *
 * These are declared so TypeScript doesn't error on dynamic imports
 * that are guarded by try/catch at runtime.
 */

declare module "@opencode-ai/sdk" {
  export function createOpencode(options?: {
    hostname?: string;
    port?: number;
    timeout?: number;
  }): Promise<{
    client: {
      session: {
        create(options: Record<string, unknown>): Promise<{ data: { id: string } }>;
        prompt(options: {
          sessionId: string;
          message: string;
          format?: Record<string, unknown>;
        }): Promise<{ data: Record<string, unknown> }>;
      };
      event: {
        subscribe(
          event: string,
          handler: (event: Record<string, unknown>) => void,
        ): void;
      };
    };
  }>;

  export function createOpencodeClient(options: {
    baseUrl: string;
  }): Record<string, unknown>;
}

declare module "@opencode-ai/plugin" {
  export interface PluginContext {
    project: Record<string, unknown>;
    client: Record<string, unknown>;
    $: Record<string, unknown>;
    directory: string;
    worktree: string;
  }

  export function tool(options: {
    description: string;
    args: Record<string, unknown>;
    execute: (args: Record<string, unknown>, context: unknown) => Promise<unknown>;
  }): unknown;
}
