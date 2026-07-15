import { describe, expect, it, vi } from "vitest";

import { AgentRunner } from "./agent-runner.service";
import { BaseAgent } from "./base-agent";
import { AgentContext, AgentDecision } from "./agent-core.types";
import { ToolRegistry } from "./tool-registry.service";

class TestAgent extends BaseAgent<AgentContext> {
  readonly name = "test";
  constructor(private readonly decisions: AgentDecision[]) { super({} as never, new ToolRegistry()); }
  buildMessages(): [] { return []; }
  getDecisionSchema(): Record<string, unknown> { return {}; }
  validateDecision(): AgentDecision { return this.decisions.shift()!; }
  shouldForceContinue(context: AgentContext): string | null { return context.degradationReasons.length === 0 ? "需要继续" : null; }
}

class GenerateTestAgent extends BaseAgent<AgentContext> {
  readonly name = "generate-test";

  constructor() {
    super({} as never, new ToolRegistry());
  }

  buildMessages(): [] {
    return [];
  }

  getDecisionSchema(): Record<string, unknown> {
    return {};
  }

  validateDecision(): AgentDecision {
    throw new Error("GenerateTestAgent does not support decisions.");
  }

  validateGeneration(raw: unknown): unknown {
    if (raw !== "valid") {
      throw new Error("Invalid generated value.");
    }

    return raw;
  }
}

describe("AgentRunner", () => {
  it("skips repeated actions and finishes after a valid artifact", async () => {
    const registry = new ToolRegistry();
    const execute = vi.fn().mockResolvedValue({ observation: "found", artifacts: ["source"] });
    registry.register({ name: "search", description: "Search", inputSchema: {}, execute });
    const llm = { completeJson: vi.fn().mockResolvedValue({ value: {} }) };
    const runner = new AgentRunner(llm as never, registry);
    const agent = new TestAgent([
      { action: "call_tool", tool: "search", input: { query: "x" } },
      { action: "call_tool", tool: "search", input: { query: "x" } },
      { action: "finish", summary: "done" }
    ]);

    const result = await runner.run(agent, { availableTools: ["search"], maxRounds: 3, degradationReasons: [] });

    expect(execute).toHaveBeenCalledOnce();
    expect(result.artifacts).toEqual(["source"]);
    expect(result.progress.toolCalls.map((call) => call.status)).toEqual(["completed", "skipped"]);
  });

  it("retries generate mode when the first response fails validation", async () => {
    const llm = {
      completeJson: vi.fn()
        .mockResolvedValueOnce({ value: "invalid" })
        .mockResolvedValueOnce({ value: "valid" })
    };
    const runner = new AgentRunner(llm as never, new ToolRegistry());

    const result = await runner.run(new GenerateTestAgent(), {
      mode: "generate",
      availableTools: [],
      maxRounds: 1,
      degradationReasons: []
    });

    expect(result.artifacts).toEqual(["valid"]);
    expect(llm.completeJson).toHaveBeenCalledTimes(2);
    expect(llm.completeJson.mock.calls[1][0].messages).toContainEqual(
      expect.objectContaining({ content: expect.stringContaining("未通过结构校验") })
    );
  });
});
