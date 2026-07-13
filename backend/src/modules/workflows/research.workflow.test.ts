import { describe, expect, it, vi } from "vitest";

import { AppConfigService } from "../infrastructure/config/app-config.service";
import { DatabaseService } from "../infrastructure/database/database.service";
import { McpService } from "../mcp/mcp.service";
import { TripRepository } from "../persistence/trip.repository";
import { AgentRunner } from "../agent-core/agent-runner.service";
import { ResearchAgent } from "../agents/research/research.agent";
import { ResearchAgentProgress, ResearchSourceDraft } from "../agents/research/research.agent.types";
import { ResearchWorkflow } from "./research.workflow";

const source: ResearchSourceDraft = {
  provider: "tavily",
  title: "杭州攻略",
  url: "https://example.com/hangzhou",
  snippet: "开放时间与预约信息",
  metadata: { tool: "web_search" }
};

const completeProgress: ResearchAgentProgress = {
  currentRound: 2,
  maxRounds: 8,
  degraded: false,
  degradationReasons: [],
  toolCalls: []
};

function createHarness(options: {
  publicStatus?: AppConfigService["publicStatus"];
  xhsStatus?: Awaited<ReturnType<McpService["getXhsStatus"]>>;
  agentError?: Error;
  activeRun?: Record<string, unknown>;
} = {}) {
  const runs = new Map<string, Record<string, unknown>>();
  const insertedSources: unknown[][] = [];
  const database = {
    query: vi.fn((sql: string, values: unknown[] = []) => {
      if (sql.includes("agent_runs.status = 'running'")) {
        return Promise.resolve({ rows: options.activeRun ? [options.activeRun] : [] });
      }

      if (sql.includes("COUNT(research_sources.id) AS source_count")) {
        return Promise.resolve({ rows: [...runs.values()].slice(-1) });
      }

      if (sql.includes("INSERT INTO agent_runs")) {
        const [id, tripId, status, stage, summary, errorMessage, checks, progress] = values;
        const row = {
          id,
          trip_id: tripId,
          status,
          stage,
          summary,
          error_message: errorMessage,
          checks: JSON.parse(String(checks)),
          progress: JSON.parse(String(progress)),
          source_count: 0,
          created_at: new Date("2026-07-12T00:00:00.000Z"),
          updated_at: new Date("2026-07-12T00:00:00.000Z"),
          completed_at: null
        };
        runs.set(String(id), row);
        return Promise.resolve({ rows: [row] });
      }

      if (sql.includes("INSERT INTO research_sources")) {
        insertedSources.push(values);
        return Promise.resolve({ rows: [] });
      }

      if (sql.includes("STALE_IN_PROCESS_RUN")) {
        return Promise.resolve({ rows: [] });
      }

      if (sql.includes("Research Agent 执行期间发生内部错误")) {
        const [id, errorMessage] = values;
        const row = runs.get(String(id));
        if (row) {
          Object.assign(row, {
            status: "failed",
            stage: "completed",
            error_message: errorMessage,
            completed_at: new Date("2026-07-12T00:01:00.000Z")
          });
        }
        return Promise.resolve({ rows: [] });
      }

      if (sql.includes("UPDATE agent_runs")) {
        const [id, status, stage, summary, errorMessage, checks, progress, completed] = values;
        const row = runs.get(String(id));
        if (!row) return Promise.resolve({ rows: [] });
        Object.assign(row, {
          status,
          stage,
          summary,
          error_message: errorMessage,
          checks: JSON.parse(String(checks)),
          progress: JSON.parse(String(progress)),
          source_count: insertedSources.filter((item) => item[1] === id).length,
          updated_at: new Date("2026-07-12T00:01:00.000Z"),
          completed_at: completed ? new Date("2026-07-12T00:01:00.000Z") : null
        });
        return Promise.resolve({ rows: [row] });
      }

      return Promise.resolve({ rows: [] });
    })
  } as unknown as DatabaseService;
  const tripsService = {
    getTrip: vi.fn().mockResolvedValue({
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
    })
  } as unknown as TripRepository;
  const config = {
    publicStatus: options.publicStatus ?? configuredStatus,
    research: { maxRounds: 8, staleAfterSeconds: 3600 },
    llm: {
      provider: "openai-compatible",
      baseUrl: "https://example.com/v1",
      apiKey: "key",
      model: "test-model",
      timeoutMs: 1000
    }
  } as AppConfigService;
  const mcpService = {
    getXhsStatus: vi.fn().mockResolvedValue(options.xhsStatus ?? loggedInXhsStatus)
  } as unknown as McpService;
  const agent = {} as ResearchAgent;
  const runner = {
    run: vi.fn().mockImplementation(async (_agent, input) => {
      if (options.agentError) throw options.agentError;
      await input.onProgress({ progress: completeProgress, newArtifacts: [source] });
      return { summary: "来源研究已完成。", artifacts: [source], progress: completeProgress };
    })
  } as unknown as AgentRunner;
  return {
    service: new ResearchWorkflow(database, tripsService, config, mcpService, runner, agent),
    runs,
    insertedSources,
    mcpService,
    agent: runner
  };
}

const configuredStatus: AppConfigService["publicStatus"] = {
  nodeEnv: "test",
  apiPort: 3000,
  webOrigin: "http://localhost:5173",
  database: "configured",
  xiaohongshuMcp: "configured",
  llm: "configured",
  amap: "configured",
  tavily: "configured"
};

const loggedInXhsStatus: Awaited<ReturnType<McpService["getXhsStatus"]>> = {
  configured: true,
  connectionStatus: "connected",
  loginStatus: "logged_in",
  tools: [{ name: "search_feeds", allowed: true }],
  readonlyTools: [],
  blockedTools: [],
  errorMessage: null
};

async function waitForTerminalRun(runs: Map<string, Record<string, unknown>>) {
  await vi.waitFor(() => {
    expect([...runs.values()][0]?.status).not.toBe("running");
  });
  return [...runs.values()][0];
}

async function waitForRunCount(runs: Map<string, Record<string, unknown>>, count: number) {
  await vi.waitFor(() => {
    expect(runs.size).toBe(count);
  });
}

describe("ResearchService", () => {
  it("returns a running run immediately and completes it in-process", async () => {
    const { service, runs, agent } = createHarness();

    const created = await service.startResearch("trip-1");

    expect(created).toMatchObject({ status: "running", stage: "created" });
    const completed = await waitForTerminalRun(runs);
    expect(completed).toMatchObject({ status: "completed", stage: "completed", source_count: 1 });
    expect(agent.run).toHaveBeenCalledOnce();
  });

  it("executes a fresh Agent run each time instead of reusing research results", async () => {
    const { service, runs, agent } = createHarness();

    await service.startResearch("trip-1");
    await waitForTerminalRun(runs);
    await service.startResearch("trip-1");
    await waitForRunCount(runs, 2);
    await vi.waitFor(() => {
      expect([...runs.values()][1]?.status).toBe("completed");
    });

    expect(agent.run).toHaveBeenCalledTimes(2);
  });

  it("blocks only when the required LLM configuration is missing", async () => {
    const { service, runs, mcpService, agent } = createHarness({
      publicStatus: { ...configuredStatus, llm: "missing" }
    });

    await service.startResearch("trip-1");
    const completed = await waitForTerminalRun(runs);

    expect(completed.status).toBe("blocked_config");
    expect(mcpService.getXhsStatus).not.toHaveBeenCalled();
    expect(agent.run).not.toHaveBeenCalled();
  });

  it("degrades Xiaohongshu when logged out and continues with other tools", async () => {
    const { service, runs, agent } = createHarness({
      xhsStatus: { ...loggedInXhsStatus, loginStatus: "logged_out" }
    });
    vi.mocked(agent.run).mockImplementation(async (_agent, input) => {
      expect(input.availableTools).not.toContain("xhs_search");
      expect(input.availableTools).toContain("web_search");
      const progress = {
        ...completeProgress,
        degraded: true,
        degradationReasons: input.degradationReasons
      };
      await input.onProgress!({ progress, newArtifacts: [source] });
      return { summary: "来源研究已完成。", artifacts: [source], progress };
    });

    await service.startResearch("trip-1");
    const completed = await waitForTerminalRun(runs);

    expect(completed.status).toBe("completed");
    expect((completed.progress as ResearchAgentProgress).degraded).toBe(true);
    expect((completed.progress as ResearchAgentProgress).degradationReasons[0]).toContain("小红书");
  });

  it("persists a failed terminal state", async () => {
    const { service, runs } = createHarness({ agentError: new Error("invalid LLM decision") });

    await service.startResearch("trip-1");
    const completed = await waitForTerminalRun(runs);

    expect(completed).toMatchObject({ status: "failed", error_message: "invalid LLM decision" });
  });

  it("reuses the active run instead of launching concurrent research", async () => {
    const activeRun = {
      id: "active-run",
      trip_id: "trip-1",
      status: "running",
      stage: "source_research",
      summary: "运行中",
      error_message: null,
      checks: {},
      progress: {},
      source_count: 0,
      created_at: new Date("2026-07-12T00:00:00.000Z"),
      updated_at: new Date("2026-07-12T00:00:00.000Z"),
      completed_at: null
    };
    const { service, agent } = createHarness({ activeRun });

    const result = await service.startResearch("trip-1");

    expect(result.id).toBe("active-run");
    expect(result.progress).toMatchObject({ currentRound: 0, maxRounds: 8, toolCalls: [] });
    expect(agent.run).not.toHaveBeenCalled();
  });

  it("normalizes legacy empty progress when reading a run", async () => {
    const { service, runs } = createHarness();
    await service.startResearch("trip-1");
    await waitForTerminalRun(runs);
    const row = [...runs.values()][0];
    row.progress = {};

    const latest = await service.getLatestRun("trip-1");

    expect(latest.progress).toEqual({
      currentRound: 0,
      maxRounds: 8,
      degraded: false,
      degradationReasons: [],
      toolCalls: []
    });
  });
});
