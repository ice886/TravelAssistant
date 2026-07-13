export interface ToolResult {
  observation: string;
  artifacts?: unknown;
}

export interface BaseTool<TInput = unknown, TContext = unknown> {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: Record<string, unknown>;
  execute(input: TInput, context: TContext): Promise<ToolResult>;
}
