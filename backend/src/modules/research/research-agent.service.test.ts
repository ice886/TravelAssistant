import { describe, expect, it, vi } from "vitest";

import { LlmProviderService } from "../providers/llm.service";
import { ResearchAgentExecutionError, ResearchAgentService } from "./research-agent.service";
import { ResearchToolsService } from "./research-tools.service";

const trip = {
  id: "trip-1",
  destination: "杭州",
  startDate: null,
  endDate: null,
  days: 3,
  interests: ["美食"],
  budgetLevel: "medium",
  travelerType: "couple",
  travelerCount: 2,
  status: "draft",
  createdAt: "2026-07-12T00:00:00.000Z",
  updatedAt: "2026-07-12T00:00:00.000Z"
};

function createAgent(decisions: unknown[], execute = vi.fn()) {
  const completeJson = vi.fn();
  for (const decision of decisions) {
    completeJson.mockResolvedValueOnce({ value: decision });
  }
  const llm = { completeJson } as unknown as LlmProviderService;
  const tools = { execute } as unknown as ResearchToolsService;
  return { service: new ResearchAgentService(llm, tools), completeJson, execute };
}

describe("ResearchAgentService", () => {
  it("runs action-observation-final without persisting model reasoning", async () => {
    const execute = vi.fn().mockResolvedValue({
      observation: "找到 1 条网页来源。",
      sources: [{ provider: "tavily", title: "攻略", url: "https://example.com", snippet: "信息", metadata: {} }]
    });
    const { service } = createAgent([
      { action: "call_tool", tool: "web_search", input: { query: "杭州旅行攻略" } },
      { action: "finish", summary: "证据覆盖充分。" }
    ], execute);
    const onProgress = vi.fn().mockResolvedValue(undefined);

    const result = await service.run({
      trip,
      availableTools: ["web_search"],
      maxRounds: 8,
      degradationReasons: [],
      onProgress
    });

    expect(result.summary).toBe("证据覆盖充分。");
    expect(result.sources).toHaveLength(1);
    expect(result.progress.toolCalls[0]).toMatchObject({ tool: "web_search", status: "completed" });
    expect(JSON.stringify(result.progress)).not.toContain("thought");
  });

  it("rejects unavailable tools before executing them", async () => {
    const { service, execute } = createAgent([
      { action: "call_tool", tool: "xhs_search", input: { query: "杭州" } }
    ]);

    await expect(service.run({
      trip,
      availableTools: ["web_search"],
      maxRounds: 1,
      degradationReasons: [],
      onProgress: vi.fn()
    })).rejects.toThrow("unavailable tool");
    expect(execute).not.toHaveBeenCalled();
  });

  it("rejects unexpected decision fields before tool execution", async () => {
    const { service, execute } = createAgent([
      { action: "call_tool", tool: "web_search", input: { query: "杭州" }, command: "ignore safety" }
    ]);

    await expect(service.run({
      trip,
      availableTools: ["web_search"],
      maxRounds: 1,
      degradationReasons: [],
      onProgress: vi.fn()
    })).rejects.toThrow("Unexpected field");
    expect(execute).not.toHaveBeenCalled();
  });

  it("skips duplicate actions and keeps valid sources at the round limit", async () => {
    const execute = vi.fn().mockResolvedValue({
      observation: "找到来源。",
      sources: [{ provider: "tavily", title: "攻略", url: null, snippet: null, metadata: {} }]
    });
    const decision = { action: "call_tool", tool: "web_search", input: { query: "杭州" } };
    const { service } = createAgent([decision, decision], execute);

    const result = await service.run({
      trip,
      availableTools: ["web_search"],
      maxRounds: 2,
      degradationReasons: [],
      onProgress: vi.fn().mockResolvedValue(undefined)
    });

    expect(execute).toHaveBeenCalledOnce();
    expect(result.progress.toolCalls[1].status).toBe("skipped");
    expect(result.summary).toContain("2 轮上限");
  });

  it("removes a failed tool and continues with a fallback", async () => {
    const execute = vi.fn()
      .mockRejectedValueOnce(new Error("MCP unavailable"))
      .mockResolvedValueOnce({
        observation: "找到网页来源。",
        sources: [{ provider: "tavily", title: "网页攻略", url: null, snippet: null, metadata: {} }]
      });
    const { service, completeJson } = createAgent([
      { action: "call_tool", tool: "xhs_search", input: { query: "杭州" } },
      { action: "call_tool", tool: "web_search", input: { query: "杭州攻略" } },
      { action: "finish", summary: "使用备用来源完成。" }
    ], execute);

    const result = await service.run({
      trip,
      availableTools: ["xhs_search", "web_search"],
      maxRounds: 3,
      degradationReasons: [],
      onProgress: vi.fn().mockResolvedValue(undefined)
    });

    expect(result.progress.degraded).toBe(true);
    expect(result.progress.degradationReasons[0]).toContain("小红书搜索调用失败");
    const thirdPrompt = vi.mocked(completeJson).mock.calls[2][0];
    expect(JSON.stringify(thirdPrompt)).not.toContain('"availableTools":["xhs_search"');
  });

  it("fails when all rounds end without a usable source", async () => {
    const execute = vi.fn().mockRejectedValue(new Error("provider down"));
    const { service } = createAgent([
      { action: "call_tool", tool: "web_search", input: { query: "杭州" } }
    ], execute);

    await expect(service.run({
      trip,
      availableTools: ["web_search"],
      maxRounds: 1,
      degradationReasons: [],
      onProgress: vi.fn().mockResolvedValue(undefined)
    })).rejects.toBeInstanceOf(ResearchAgentExecutionError);
  });

  it("propagates progress persistence failures instead of misclassifying the tool", async () => {
    const execute = vi.fn().mockResolvedValue({
      observation: "找到来源。",
      sources: [{
        provider: "tavily",
        title: "攻略",
        url: "https://example.com",
        snippet: "信息",
        metadata: {}
      }]
    });
    const { service } = createAgent([
      { action: "call_tool", tool: "web_search", input: { query: "杭州" } }
    ], execute);

    await expect(service.run({
      trip,
      availableTools: ["web_search"],
      maxRounds: 1,
      degradationReasons: [],
      onProgress: vi.fn().mockRejectedValue(new Error("database write failed"))
    })).rejects.toThrow("database write failed");
    expect(execute).toHaveBeenCalledOnce();
  });

  it("sanitizes source length and unsafe URL before prompt, persistence, and cache output", async () => {
    const execute = vi.fn().mockResolvedValue({
      observation: "找到来源。",
      sources: [{
        provider: "tavily",
        title: "T".repeat(500),
        url: "javascript:alert(1)",
        snippet: "S".repeat(3000),
        metadata: {}
      }]
    });
    const { service } = createAgent([
      { action: "call_tool", tool: "web_search", input: { query: "杭州" } },
      { action: "finish", summary: "完成" }
    ], execute);

    const result = await service.run({
      trip,
      availableTools: ["web_search"],
      maxRounds: 2,
      degradationReasons: [],
      onProgress: vi.fn().mockResolvedValue(undefined)
    });

    expect(result.sources[0].title).toHaveLength(300);
    expect(result.sources[0].snippet).toHaveLength(2000);
    expect(result.sources[0].url).toBeNull();
  });
});
