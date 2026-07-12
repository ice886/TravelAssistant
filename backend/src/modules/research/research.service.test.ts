import { Logger } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { AppConfigService } from "../config/app-config.service";
import { DatabaseService } from "../database/database.service";
import { McpService } from "../mcp/mcp.service";
import { TripsService } from "../trips/trips.service";
import { ResearchAgentService } from "./research-agent.service";
import { ResearchAgentProgress, ResearchSourceDraft } from "./research-agent.types";
import { ResearchCacheService } from "./research-cache.service";
import { ResearchService } from "./research.service";

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
  cacheHit: false,
  degraded: false,
  degradationReasons: [],
  toolCalls: []
};

function createHarness(options: {
  publicStatus?: AppConfigService["publicStatus"];
  xhsStatus?: Awaited<ReturnType<McpService["getXhsStatus"]>>;
  cachedSources?: ResearchSourceDraft[] | null;
  agentError?: Error;
  cacheError?: Error;
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

      if (sql.includes("WITH inserted_sources AS")) {
        const [runId, serializedSources, summary, checks, progress] = values;
        const cachedSources = JSON.parse(String(serializedSources)) as Array<Record<string, unknown>>;
        for (const cachedSource of cachedSources) {
          insertedSources.push([
            cachedSource.id,
            runId,
            cachedSource.provider,
            cachedSource.title,
            cachedSource.url,
            cachedSource.snippet,
            JSON.stringify(cachedSource.metadata)
          ]);
        }
        const row = runs.get(String(runId));
        if (row) {
          Object.assign(row, {
            status: "completed",
            stage: "completed",
            summary,
            checks: JSON.parse(String(checks)),
            progress: JSON.parse(String(progress)),
            source_count: cachedSources.length,
            completed_at: new Date("2026-07-12T00:01:00.000Z")
          });
        }
        return Promise.resolve({ rows: [] });
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
  } as unknown as TripsService;
  const config = {
    publicStatus: options.publicStatus ?? configuredStatus,
    research: { maxRounds: 8, cacheTtlSeconds: 604800, staleAfterSeconds: 3600 },
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
  const agent = {
    run: vi.fn().mockImplementation(async (input) => {
      if (options.agentError) throw options.agentError;
      await input.onProgress({ progress: completeProgress, newSources: [source] });
      return { summary: "来源研究已完成。", sources: [source], progress: completeProgress };
    })
  } as unknown as ResearchAgentService;
  const cache = {
    buildKey: vi.fn().mockReturnValue("cache-key"),
    get: options.cacheError
      ? vi.fn().mockRejectedValue(options.cacheError)
      : vi.fn().mockResolvedValue(options.cachedSources
          ? { sources: options.cachedSources, degraded: false, degradationReasons: [] }
          : null),
    set: vi.fn().mockResolvedValue(undefined)
  } as unknown as ResearchCacheService;

  return {
    service: new ResearchService(database, tripsService, config, mcpService, agent, cache),
    runs,
    insertedSources,
    mcpService,
    agent,
    cache
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

describe("ResearchService", () => {
  it("returns a running run immediately and completes it in-process", async () => {
    const { service, runs, agent, cache } = createHarness();

    const created = await service.startResearch("trip-1");

    expect(created).toMatchObject({ status: "running", stage: "created" });
    const completed = await waitForTerminalRun(runs);
    expect(completed).toMatchObject({ status: "completed", stage: "completed", source_count: 1 });
    expect(agent.run).toHaveBeenCalledOnce();
    expect(cache.set).toHaveBeenCalledWith("cache-key", [source], 604800, false, []);
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
    vi.mocked(agent.run).mockImplementation(async (input) => {
      expect(input.availableTools).not.toContain("xhs_search");
      expect(input.availableTools).toContain("web_search");
      const progress = {
        ...completeProgress,
        degraded: true,
        degradationReasons: input.degradationReasons
      };
      await input.onProgress({ progress, newSources: [source] });
      return { summary: "来源研究已完成。", sources: [source], progress };
    });

    await service.startResearch("trip-1");
    const completed = await waitForTerminalRun(runs);

    expect(completed.status).toBe("completed");
    expect((completed.progress as ResearchAgentProgress).degraded).toBe(true);
    expect((completed.progress as ResearchAgentProgress).degradationReasons[0]).toContain("小红书");
  });

  it("materializes cached sources with fresh ids and skips all external services", async () => {
    const { service, runs, insertedSources, mcpService, agent } = createHarness({ cachedSources: [source] });

    await service.startResearch("trip-1");
    const completed = await waitForTerminalRun(runs);

    expect(completed.status).toBe("completed");
    expect((completed.progress as ResearchAgentProgress).cacheHit).toBe(true);
    expect(insertedSources).toHaveLength(1);
    expect(String(insertedSources[0][0])).toMatch(/^[0-9a-f-]{36}$/);
    expect(insertedSources[0][1]).toBe(completed.id);
    expect(JSON.parse(String(insertedSources[0][6]))).toMatchObject({ cacheHit: true });
    expect(mcpService.getXhsStatus).not.toHaveBeenCalled();
    expect(agent.run).not.toHaveBeenCalled();
  });

  it("persists a failed terminal state and does not cache failed runs", async () => {
    const { service, runs, cache } = createHarness({ agentError: new Error("invalid LLM decision") });

    await service.startResearch("trip-1");
    const completed = await waitForTerminalRun(runs);

    expect(completed).toMatchObject({ status: "failed", error_message: "invalid LLM decision" });
    expect(cache.set).not.toHaveBeenCalled();
  });

  it("marks the run failed when cache preflight throws unexpectedly", async () => {
    const logger = vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    const { service, runs, agent } = createHarness({ cacheError: new Error("database unavailable") });

    await service.startResearch("trip-1");
    const completed = await waitForTerminalRun(runs);

    expect(completed).toMatchObject({ status: "failed", error_message: "database unavailable" });
    expect(agent.run).not.toHaveBeenCalled();
    logger.mockRestore();
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
      cacheHit: false,
      degraded: false,
      degradationReasons: [],
      toolCalls: []
    });
  });
});
