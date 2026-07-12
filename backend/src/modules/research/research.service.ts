import { Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";

import { AppConfigService, PublicConfigStatus } from "../config/app-config.service";
import { DatabaseService } from "../database/database.service";
import { McpService } from "../mcp/mcp.service";
import { XhsStatusResponse } from "../mcp/mcp.types";
import { TripsService } from "../trips/trips.service";
import { Trip } from "../trips/trip.types";
import { ResearchAgentExecutionError, ResearchAgentService } from "./research-agent.service";
import {
  ResearchAgentProgress,
  ResearchSourceDraft,
  ResearchToolName
} from "./research-agent.types";
import { ResearchCacheService } from "./research-cache.service";
import {
  AgentRun,
  AgentRunChecks,
  AgentRunRow,
  AgentRunStage,
  AgentRunStatus,
  ResearchSource,
  ResearchSourceRow
} from "./research.types";

@Injectable()
export class ResearchService {
  private readonly logger = new Logger(ResearchService.name);

  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(TripsService) private readonly tripsService: TripsService,
    @Inject(AppConfigService) private readonly config: AppConfigService,
    @Inject(McpService) private readonly mcpService: McpService,
    @Inject(ResearchAgentService) private readonly agent: ResearchAgentService,
    @Inject(ResearchCacheService) private readonly cache: ResearchCacheService
  ) {}

  async startResearch(tripId: string): Promise<AgentRun> {
    const trip = await this.tripsService.getTrip(tripId);
    await this.expireStaleRuns(tripId);
    const activeRun = await this.findActiveRun(tripId);
    if (activeRun) {
      return activeRun;
    }

    const runId = randomUUID();
    const progress = this.emptyProgress();
    const run = await this.insertRun(
      runId,
      tripId,
      "running",
      "created",
      "研究任务已创建，正在准备执行。",
      null,
      this.emptyChecks(),
      progress
    );

    if (!run) {
      const concurrentRun = await this.findActiveRun(tripId);
      if (!concurrentRun) {
        throw new Error("Research run could not be created after an active-run conflict.");
      }
      return concurrentRun;
    }

    this.startInProcessExecution(runId, trip);
    return run;
  }

  async getLatestRun(tripId: string): Promise<AgentRun> {
    await this.tripsService.getTrip(tripId);

    const result = await this.database.query<AgentRunRow>(
      `
        SELECT
          agent_runs.*,
          COUNT(research_sources.id) AS source_count
        FROM agent_runs
        LEFT JOIN research_sources ON research_sources.run_id = agent_runs.id
        WHERE agent_runs.trip_id = $1
        GROUP BY agent_runs.id
        ORDER BY agent_runs.created_at DESC, agent_runs.id DESC
        LIMIT 1
      `,
      [tripId]
    );
    const run = result.rows[0];

    if (!run) {
      throw new NotFoundException("Research run not found.");
    }

    return this.toAgentRun(run);
  }

  async getSources(tripId: string): Promise<ResearchSource[]> {
    await this.tripsService.getTrip(tripId);
    const result = await this.database.query<ResearchSourceRow>(
      `
        SELECT *
        FROM research_sources
        WHERE run_id = (
          SELECT id FROM agent_runs WHERE trip_id = $1 ORDER BY created_at DESC, id DESC LIMIT 1
        )
        ORDER BY created_at ASC
      `,
      [tripId]
    );
    return result.rows.map((row) => this.toSource(row));
  }

  private startInProcessExecution(runId: string, trip: Trip): void {
    void Promise.resolve()
      .then(() => this.executeResearch(runId, trip))
      .catch(async (error: unknown) => {
        this.logger.error(`Research run ${runId} failed unexpectedly: ${safeError(error)}`);
        try {
          await this.markUnexpectedFailure(runId, error);
        } catch (persistError) {
          this.logger.error(
            `Research run ${runId} could not persist its terminal state: ${safeError(persistError)}`
          );
        }
      });
  }

  private async expireStaleRuns(tripId: string): Promise<void> {
    const staleBefore = new Date(Date.now() - this.config.research.staleAfterSeconds * 1000);
    await this.database.query(
      `
        UPDATE agent_runs
        SET
          status = 'failed',
          stage = 'completed',
          summary = '上一次进程内研究任务已超时终止。',
          error_message = 'STALE_IN_PROCESS_RUN',
          updated_at = now(),
          completed_at = now()
        WHERE trip_id = $1 AND status = 'running' AND updated_at < $2
      `,
      [tripId, staleBefore]
    );
  }

  private async findActiveRun(tripId: string): Promise<AgentRun | null> {
    const result = await this.database.query<AgentRunRow>(
      `
        SELECT
          agent_runs.*,
          COUNT(research_sources.id) AS source_count
        FROM agent_runs
        LEFT JOIN research_sources ON research_sources.run_id = agent_runs.id
        WHERE agent_runs.trip_id = $1 AND agent_runs.status = 'running'
        GROUP BY agent_runs.id
        ORDER BY agent_runs.created_at DESC, agent_runs.id DESC
        LIMIT 1
      `,
      [tripId]
    );
    return result.rows[0] ? this.toAgentRun(result.rows[0]) : null;
  }

  private async executeResearch(runId: string, trip: Trip): Promise<void> {
    const publicStatus = this.config.publicStatus;
    const cacheKey = this.cache.buildKey(trip, this.cacheProfile(publicStatus));
    const cachedEntry = await this.cache.get(cacheKey);

    if (cachedEntry) {
      const progress: ResearchAgentProgress = {
        ...this.emptyProgress(),
        cacheHit: true,
        degraded: cachedEntry.degraded,
        degradationReasons: cachedEntry.degradationReasons
      };
      await this.completeFromCache(runId, cachedEntry.sources, progress);
      return;
    }

    const configChecks = this.createConfigChecks(publicStatus);
    if (configChecks.llm.status === "missing") {
      await this.updateRun(runId, {
        status: "blocked_config",
        stage: "config_check",
        summary: "研究任务因 LLM 配置缺失而暂停。",
        errorMessage: configChecks.llm.message,
        checks: configChecks,
        progress: this.emptyProgress(),
        completed: true
      });
      return;
    }

    const xhsStatus = await this.readXhsStatus(configChecks);
    const checks: AgentRunChecks = {
      ...configChecks,
      xiaohongshu: this.createXhsCheck(xhsStatus)
    };
    const availableTools = this.availableTools(checks);
    const degradationReasons = this.initialDegradationReasons(checks);
    const initialProgress: ResearchAgentProgress = {
      ...this.emptyProgress(),
      degraded: degradationReasons.length > 0,
      degradationReasons
    };

    if (availableTools.length === 0) {
      await this.updateRun(runId, {
        status: "blocked_config",
        stage: "config_check",
        summary: "研究任务没有可用的来源工具。",
        errorMessage: degradationReasons.join("；"),
        checks,
        progress: initialProgress,
        completed: true
      });
      return;
    }

    await this.updateRun(runId, {
      status: "running",
      stage: "source_research",
      summary: "预检已完成，Research Agent 正在选择工具并采集来源。",
      errorMessage: null,
      checks,
      progress: initialProgress
    });

    let latestProgress = initialProgress;

    try {
      const result = await this.agent.run({
        trip,
        availableTools,
        maxRounds: this.config.research.maxRounds,
        degradationReasons,
        onProgress: async ({ progress, newSources }) => {
          for (const source of newSources) {
            await this.insertSource(runId, source, false);
          }
          latestProgress = progress;
          await this.updateRun(runId, {
            status: "running",
            stage: "source_research",
            summary: `Research Agent 已执行 ${progress.currentRound}/${progress.maxRounds} 轮。`,
            errorMessage: null,
            checks,
            progress
          });
        }
      });

      if (this.shouldCache(publicStatus, checks, result.progress)) {
        try {
          await this.cache.set(
            cacheKey,
            result.sources,
            this.config.research.cacheTtlSeconds,
            result.progress.degraded,
            result.progress.degradationReasons
          );
        } catch (error) {
          this.logger.warn(`Research cache write failed for run ${runId}: ${safeError(error)}`);
        }
      }

      await this.updateRun(runId, {
        status: "completed",
        stage: "completed",
        summary: result.progress.degraded
          ? `${result.summary} 部分来源不可用，已使用其余来源完成研究。`
          : result.summary,
        errorMessage: null,
        checks,
        progress: result.progress,
        completed: true
      });
    } catch (error) {
      const progress = error instanceof ResearchAgentExecutionError ? error.progress : latestProgress;
      await this.updateRun(runId, {
        status: "failed",
        stage: "completed",
        summary: "Research Agent 未能完成来源研究。",
        errorMessage: safeError(error),
        checks,
        progress,
        completed: true
      });
    }
  }

  private async readXhsStatus(checks: AgentRunChecks): Promise<XhsStatusResponse> {
    if (checks.xiaohongshu.status === "missing") {
      return {
        configured: false,
        connectionStatus: "not_configured",
        loginStatus: "unknown",
        tools: [],
        readonlyTools: [],
        blockedTools: [],
        errorMessage: "XHS_MCP_URL 未配置。"
      };
    }

    return this.mcpService.getXhsStatus();
  }

  private availableTools(checks: AgentRunChecks): ResearchToolName[] {
    const tools: ResearchToolName[] = [];
    if (checks.xiaohongshu.status === "passed") {
      tools.push("xhs_search");
    }
    if (checks.tavily.status === "passed") {
      tools.push("web_search");
    }
    if (checks.amap.status === "passed") {
      tools.push("poi_search", "get_weather", "get_route");
    }
    return tools;
  }

  private initialDegradationReasons(checks: AgentRunChecks): string[] {
    const reasons: string[] = [];
    if (checks.xiaohongshu.status !== "passed") {
      reasons.push(`小红书数据不可用：${checks.xiaohongshu.message}`);
    }
    if (checks.tavily.status !== "passed") {
      reasons.push(`网页搜索不可用：${checks.tavily.message}`);
    }
    if (checks.amap.status !== "passed") {
      reasons.push(`高德地图不可用：${checks.amap.message}`);
    }
    return reasons;
  }

  private cacheProfile(status: PublicConfigStatus): string[] {
    const llm = this.config.llm;
    return [
      `llm:${llm.provider}:${llm.model ?? "missing"}`,
      `amap:${status.amap}`,
      `tavily:${status.tavily}`,
      `xiaohongshu:${status.xiaohongshuMcp}`
    ];
  }

  private shouldCache(
    status: PublicConfigStatus,
    checks: AgentRunChecks,
    progress: ResearchAgentProgress
  ): boolean {
    const failedTool = progress.toolCalls.some((call) => call.status === "failed");
    const configuredXhsUnavailable =
      status.xiaohongshuMcp === "configured" && checks.xiaohongshu.status !== "passed";
    return !failedTool && !configuredXhsUnavailable;
  }

  private async insertSource(
    runId: string,
    source: ResearchSourceDraft,
    cacheHit: boolean
  ): Promise<void> {
    await this.database.query(
      `
        INSERT INTO research_sources (id, run_id, provider, title, url, snippet, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
      `,
      [
        randomUUID(),
        runId,
        source.provider,
        source.title.slice(0, 300),
        source.url,
        source.snippet?.slice(0, 2000) ?? null,
        JSON.stringify({ ...source.metadata, cacheHit })
      ]
    );
  }

  private async completeFromCache(
    runId: string,
    sources: ResearchSourceDraft[],
    progress: ResearchAgentProgress
  ): Promise<void> {
    const materializedSources = sources.map((source) => ({
      id: randomUUID(),
      provider: source.provider,
      title: source.title.slice(0, 300),
      url: source.url,
      snippet: source.snippet?.slice(0, 2000) ?? null,
      metadata: { ...source.metadata, cacheHit: true }
    }));
    const summary = progress.degraded
      ? `命中研究缓存，已复用 ${sources.length} 条来源；缓存覆盖范围受限。`
      : `命中研究缓存，已复用 ${sources.length} 条来源。`;

    await this.database.query(
      `
        WITH inserted_sources AS (
          INSERT INTO research_sources (id, run_id, provider, title, url, snippet, metadata)
          SELECT
            cached.id,
            $1,
            cached.provider,
            cached.title,
            cached.url,
            cached.snippet,
            cached.metadata
          FROM jsonb_to_recordset($2::jsonb) AS cached(
            id uuid,
            provider text,
            title text,
            url text,
            snippet text,
            metadata jsonb
          )
          WHERE EXISTS (
            SELECT 1 FROM agent_runs active_run
            WHERE active_run.id = $1 AND active_run.status = 'running'
          )
          RETURNING id
        )
        UPDATE agent_runs
        SET
          status = 'completed',
          stage = 'completed',
          summary = $3,
          error_message = NULL,
          checks = $4::jsonb,
          progress = $5::jsonb,
          updated_at = now(),
          completed_at = now()
        WHERE id = $1 AND status = 'running'
      `,
      [
        runId,
        JSON.stringify(materializedSources),
        summary,
        JSON.stringify(this.cachedChecks()),
        JSON.stringify(progress)
      ]
    );
  }

  private async markUnexpectedFailure(id: string, error: unknown): Promise<void> {
    await this.database.query(
      `
        UPDATE agent_runs
        SET
          status = 'failed',
          stage = 'completed',
          summary = 'Research Agent 执行期间发生内部错误。',
          error_message = $2,
          updated_at = now(),
          completed_at = now()
        WHERE id = $1
      `,
      [id, safeError(error)]
    );
  }

  private async insertRun(
    id: string,
    tripId: string,
    status: AgentRunStatus,
    stage: AgentRunStage,
    summary: string,
    errorMessage: string | null,
    checks: AgentRunChecks,
    progress: ResearchAgentProgress
  ): Promise<AgentRun | null> {
    const result = await this.database.query<AgentRunRow>(
      `
        INSERT INTO agent_runs (
          id,
          trip_id,
          status,
          stage,
          summary,
          error_message,
          checks,
          progress
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb)
        ON CONFLICT (trip_id) WHERE status = 'running' DO NOTHING
        RETURNING *, 0 AS source_count
      `,
      [
        id,
        tripId,
        status,
        stage,
        summary,
        errorMessage,
        JSON.stringify(checks),
        JSON.stringify(progress)
      ]
    );

    return result.rows[0] ? this.toAgentRun(result.rows[0]) : null;
  }

  private async updateRun(
    id: string,
    input: {
      status: AgentRunStatus;
      stage: AgentRunStage;
      summary: string;
      errorMessage: string | null;
      checks: AgentRunChecks;
      progress: ResearchAgentProgress;
      completed?: boolean;
    }
  ): Promise<AgentRun> {
    const result = await this.database.query<AgentRunRow>(
      `
        UPDATE agent_runs
        SET
          status = $2,
          stage = $3,
          summary = $4,
          error_message = $5,
          checks = $6::jsonb,
          progress = $7::jsonb,
          updated_at = now(),
          completed_at = CASE WHEN $8 THEN now() ELSE completed_at END
        WHERE id = $1 AND status = 'running'
        RETURNING
          *,
          (
            SELECT COUNT(*)
            FROM research_sources
            WHERE research_sources.run_id = agent_runs.id
          ) AS source_count
      `,
      [
        id,
        input.status,
        input.stage,
        input.summary,
        input.errorMessage,
        JSON.stringify(input.checks),
        JSON.stringify(input.progress),
        Boolean(input.completed)
      ]
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error("Research run is no longer active.");
    }
    return this.toAgentRun(row);
  }

  private createConfigChecks(status: PublicConfigStatus): AgentRunChecks {
    return {
      llm: this.configCheck(status.llm, "LLM 已配置。", "LLM_API_KEY 或 LLM_MODEL 未配置。"),
      amap: this.configCheck(status.amap, "高德地图已配置。", "AMAP_API_KEY 未配置。"),
      tavily: this.configCheck(status.tavily, "Tavily 已配置。", "TAVILY_API_KEY 未配置。"),
      xiaohongshu: this.configCheck(
        status.xiaohongshuMcp,
        "小红书 MCP 已配置。",
        "XHS_MCP_URL 未配置。"
      )
    };
  }

  private configCheck(
    status: "configured" | "missing",
    configuredMessage: string,
    missingMessage: string
  ): AgentRunChecks["llm"] {
    return status === "configured"
      ? { status: "passed", message: configuredMessage }
      : { status: "missing", message: missingMessage };
  }

  private createXhsCheck(status: XhsStatusResponse): AgentRunChecks["xiaohongshu"] {
    if (!status.configured) {
      return {
        status: "skipped",
        message: "小红书 MCP 未配置，本轮已自动降级。"
      };
    }
    if (status.connectionStatus !== "connected") {
      return {
        status: "unavailable",
        message: status.errorMessage ?? "小红书 MCP 暂不可用，本轮已自动降级。"
      };
    }
    if (status.loginStatus === "logged_out") {
      return {
        status: "waiting",
        message: "小红书账号未登录，本轮已自动降级。"
      };
    }
    if (status.loginStatus !== "logged_in") {
      return {
        status: "unavailable",
        message: "小红书登录状态未知，本轮已自动降级。"
      };
    }

    const searchTool = status.tools.find((tool) => tool.name === "search_feeds");
    if (!searchTool?.allowed) {
      return {
        status: "unavailable",
        message: "小红书 MCP 未提供允许的只读搜索工具，本轮已自动降级。"
      };
    }

    return {
      status: "passed",
      message: "小红书 MCP 已连接且已登录。"
    };
  }

  private emptyChecks(): AgentRunChecks {
    return {
      llm: { status: "skipped", message: "等待检查。" },
      amap: { status: "skipped", message: "等待检查。" },
      tavily: { status: "skipped", message: "等待检查。" },
      xiaohongshu: { status: "skipped", message: "等待检查。" }
    };
  }

  private cachedChecks(): AgentRunChecks {
    const cacheCheck = { status: "skipped" as const, message: "命中缓存，未调用外部服务。" };
    return {
      llm: { ...cacheCheck },
      amap: { ...cacheCheck },
      tavily: { ...cacheCheck },
      xiaohongshu: { ...cacheCheck }
    };
  }

  private emptyProgress(): ResearchAgentProgress {
    return {
      currentRound: 0,
      maxRounds: this.config.research.maxRounds,
      cacheHit: false,
      degraded: false,
      degradationReasons: [],
      toolCalls: []
    };
  }

  private toAgentRun(row: AgentRunRow): AgentRun {
    const checks = normalizeChecks(parseJsonField<unknown>(row.checks, {}), this.emptyChecks());
    const progress = normalizeProgress(parseJsonField<unknown>(row.progress, {}), this.emptyProgress());

    return {
      id: row.id,
      tripId: row.trip_id,
      status: row.status,
      stage: row.stage,
      summary: row.summary,
      errorMessage: row.error_message,
      checks,
      progress,
      sourceCount: Number(row.source_count ?? 0),
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      completedAt: row.completed_at?.toISOString() ?? null
    };
  }

  private toSource(row: ResearchSourceRow): ResearchSource {
    return {
      id: row.id,
      runId: row.run_id,
      provider: row.provider,
      title: row.title,
      url: row.url,
      snippet: row.snippet,
      metadata: parseJsonField(row.metadata, {}),
      createdAt: row.created_at.toISOString()
    };
  }
}

function parseJsonField<T>(value: T | string | undefined, fallback: T): T {
  if (value === undefined) {
    return fallback;
  }
  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function safeError(error: unknown): string {
  return error instanceof Error ? error.message : "未知错误";
}

function normalizeChecks(value: unknown, fallback: AgentRunChecks): AgentRunChecks {
  if (!isRecord(value)) {
    return fallback;
  }

  return {
    llm: isRunCheck(value.llm) ? value.llm : fallback.llm,
    amap: isRunCheck(value.amap) ? value.amap : fallback.amap,
    tavily: isRunCheck(value.tavily) ? value.tavily : fallback.tavily,
    xiaohongshu: isRunCheck(value.xiaohongshu) ? value.xiaohongshu : fallback.xiaohongshu
  };
}

function normalizeProgress(value: unknown, fallback: ResearchAgentProgress): ResearchAgentProgress {
  if (!isRecord(value)) {
    return fallback;
  }

  return {
    currentRound: nonNegativeInteger(value.currentRound) ?? fallback.currentRound,
    maxRounds: positiveInteger(value.maxRounds) ?? fallback.maxRounds,
    cacheHit: typeof value.cacheHit === "boolean" ? value.cacheHit : fallback.cacheHit,
    degraded: typeof value.degraded === "boolean" ? value.degraded : fallback.degraded,
    degradationReasons: Array.isArray(value.degradationReasons)
      ? value.degradationReasons.filter((item): item is string => typeof item === "string")
      : fallback.degradationReasons,
    toolCalls: Array.isArray(value.toolCalls)
      ? value.toolCalls.filter(isToolCallRecord)
      : fallback.toolCalls
  };
}

function isRunCheck(value: unknown): value is AgentRunChecks["llm"] {
  return isRecord(value) && typeof value.status === "string" && typeof value.message === "string";
}

function isToolCallRecord(value: unknown): value is ResearchAgentProgress["toolCalls"][number] {
  return isRecord(value)
    && nonNegativeInteger(value.round) !== null
    && typeof value.tool === "string"
    && (value.status === "completed" || value.status === "failed" || value.status === "skipped")
    && typeof value.inputSummary === "string"
    && typeof value.observationSummary === "string"
    && nonNegativeInteger(value.sourceCount) !== null;
}

function nonNegativeInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

function positiveInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
