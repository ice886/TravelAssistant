import { LlmProviderService } from "../infrastructure/providers/llm.service";
import { AgentContext, AgentDecision, AgentMessages, ToolCallRecord } from "./agent-core.types";
import { ToolResult } from "./interfaces/tool.interface";
import { ToolRegistry } from "./tool-registry.service";

export abstract class BaseAgent<TContext extends AgentContext = AgentContext> {
  abstract readonly name: string;

  constructor(
    protected readonly llm: LlmProviderService,
    protected readonly toolRegistry: ToolRegistry
  ) {}

  abstract buildMessages(context: TContext, history: ToolCallRecord[]): AgentMessages;

  abstract getDecisionSchema(): Record<string, unknown>;

  abstract validateDecision(raw: unknown, availableTools: string[]): AgentDecision;

  validateGeneration(raw: unknown, _context: TContext): unknown {
    void _context;
    return raw;
  }

  processArtifacts(result: ToolResult, context: TContext): unknown[] {
    void context;
    return normalizeArtifacts(result.artifacts);
  }

  shouldForceContinue(context: TContext): string | null {
    void context;
    return null;
  }
}

function normalizeArtifacts(value: unknown): unknown[] {
  return value === undefined ? [] : Array.isArray(value) ? value : [value];
}
