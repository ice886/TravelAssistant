import { Inject, Injectable } from "@nestjs/common";

import { LlmProviderService } from "../infrastructure/providers/llm.service";
import { LlmJsonRequest, LlmJsonResponse } from "../infrastructure/providers/provider.types";
import { AgentExecutionError, ToolExecutionError } from "./agent-core.errors";
import {
  AgentContext,
  AgentProgress,
  AgentProgressUpdate,
  AgentResult,
  ToolCallRecord
} from "./agent-core.types";
import { BaseAgent } from "./base-agent";
import { ToolRegistry } from "./tool-registry.service";

@Injectable()
export class AgentRunner {
  constructor(
    @Inject(LlmProviderService) private readonly llm: LlmProviderService,
    @Inject(ToolRegistry) private readonly toolRegistry: ToolRegistry
  ) {}

  async run<TContext extends AgentContext>(agent: BaseAgent<TContext>, context: TContext): Promise<AgentResult> {
    if ((context.mode ?? "react") === "generate") {
      return this.runGenerate(agent, context);
    }
    const availableTools = new Set(context.availableTools);
    const artifacts: unknown[] = [];
    const actionKeys = new Set<string>();
    const history: ToolCallRecord[] = [];
    const runtimeNotes: string[] = [];
    context.runtimeNotes = runtimeNotes;
    const progress: AgentProgress = {
      currentRound: 0,
      maxRounds: context.maxRounds,
      degraded: Boolean(context.degradationReasons?.length),
      degradationReasons: [...(context.degradationReasons ?? [])],
      toolCalls: history
    };

    for (let round = 1; round <= context.maxRounds; round += 1) {
      progress.currentRound = round;
      let response;
      try {
        response = await this.completeJsonWithRetry({
          schemaName: `${agent.name}_decision`,
          schema: agent.getDecisionSchema(),
          temperature: 0.1,
          maxTokens: 800,
          messages: agent.buildMessages(context, history)
        });
      } catch (error) {
        if (artifacts.length === 0) throw error;
        const reason = `LLM 决策暂不可用，已保留当前已采集的 ${artifacts.length} 个制品。`;
        progress.degraded = true;
        addUnique(progress.degradationReasons, reason);
        addUnique(runtimeNotes, error instanceof Error ? error.message : reason);
        await this.emitProgress(context, progress, []);
        return { summary: reason, artifacts, progress: cloneProgress(progress) };
      }
      const decision = agent.validateDecision(response.value, [...availableTools]);

      if (decision.action === "finish") {
        const forceReason = agent.shouldForceContinue(context);
        if (!forceReason) {
          await this.emitProgress(context, progress, []);
          return { summary: decision.summary, artifacts, progress: cloneProgress(progress) };
        }

        progress.degraded = true;
        addUnique(progress.degradationReasons, forceReason);
        addUnique(runtimeNotes, forceReason);
        await this.emitProgress(context, progress, []);
        continue;
      }

      const actionKey = JSON.stringify([decision.tool, decision.input]);
      if (actionKeys.has(actionKey)) {
        history.push({
          round,
          tool: decision.tool,
          status: "skipped",
          inputSummary: summarizeInput(decision.input),
          observationSummary: "相同工具参数已经执行，本轮跳过重复调用。",
          sourceCount: 0
        });
        await this.emitProgress(context, progress, []);
        continue;
      }
      actionKeys.add(actionKey);

      const tool = this.toolRegistry.get(decision.tool);
      if (!tool) {
        await this.handleToolFailure(context, progress, availableTools, decision.tool, round, decision.input, runtimeNotes, new Error("Tool is not registered."));
        if (availableTools.size === 0) break;
        continue;
      }

      try {
        const result = await tool.execute(decision.input, context);
        const newArtifacts = agent.processArtifacts(result, context);
        artifacts.push(...newArtifacts);
        history.push({
          round,
          tool: decision.tool,
          status: "completed",
          inputSummary: summarizeInput(decision.input),
          observationSummary: limitText(result.observation, 300),
          sourceCount: newArtifacts.length
        });
        await this.emitProgress(context, progress, newArtifacts);
      } catch (error) {
        await this.handleToolFailure(context, progress, availableTools, decision.tool, round, decision.input, runtimeNotes, error);
        if (availableTools.size === 0) break;
      }
    }

    if (artifacts.length === 0) {
      throw new AgentExecutionError("Agent 未能收集到可用制品。", progress);
    }

    return {
      summary: `研究达到 ${context.maxRounds} 轮上限，已保留当前制品。`,
      artifacts,
      progress: cloneProgress(progress)
    };
  }

  private async runGenerate<TContext extends AgentContext>(agent: BaseAgent<TContext>, context: TContext): Promise<AgentResult> {
    const response = await this.completeJsonWithRetry({
      schemaName: `${agent.name}_output`,
      schema: agent.getDecisionSchema(),
      temperature: 0.2,
      messages: agent.buildMessages(context, [])
    });
    const artifact = agent.validateGeneration(response.value, context);
    const progress: AgentProgress = { currentRound: 1, maxRounds: 1, degraded: false, degradationReasons: [], toolCalls: [] };
    await this.emitProgress(context, progress, [artifact]);
    return { summary: `${agent.name} 生成完成。`, artifacts: [artifact], progress };
  }

  private async completeJsonWithRetry<TValue>(request: LlmJsonRequest): Promise<LlmJsonResponse<TValue>> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        return await this.llm.completeJson<TValue>(request);
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError instanceof Error ? lastError : new Error("LLM JSON completion failed.");
  }

  private async handleToolFailure<TContext extends AgentContext>(
    context: TContext,
    progress: AgentProgress,
    availableTools: Set<string>,
    toolName: string,
    round: number,
    input: unknown,
    runtimeNotes: string[],
    error: unknown
  ): Promise<void> {
    const reason = `${toolName}调用失败，已从本轮工具集中移除。`;
    availableTools.delete(toolName);
    progress.degraded = true;
    addUnique(progress.degradationReasons, reason);
    addUnique(runtimeNotes, safeError(error));
    progress.toolCalls.push({
      round,
      tool: toolName,
      status: "failed",
      inputSummary: summarizeInput(input),
      observationSummary: limitText(reason, 300),
      sourceCount: 0
    });
    await this.emitProgress(context, progress, []);
  }

  private async emitProgress<TContext extends AgentContext>(
    context: TContext,
    progress: AgentProgress,
    newArtifacts: unknown[]
  ): Promise<void> {
    if (context.onProgress) {
      await context.onProgress({ progress: cloneProgress(progress), newArtifacts } satisfies AgentProgressUpdate);
    }
  }
}

function cloneProgress(progress: AgentProgress): AgentProgress {
  return {
    ...progress,
    degradationReasons: [...progress.degradationReasons],
    toolCalls: progress.toolCalls.map((call) => ({ ...call }))
  };
}

function summarizeInput(input: unknown): string {
  if (typeof input !== "object" || input === null) return limitText(String(input), 300);
  return limitText(Object.entries(input).map(([key, value]) => `${key}=${String(value)}`).join("，"), 300);
}

function limitText(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

function addUnique(values: string[], value: string): void {
  if (!values.includes(value)) values.push(value);
}

function safeError(error: unknown): string {
  return error instanceof ToolExecutionError || error instanceof Error ? error.message : "未知工具错误";
}
