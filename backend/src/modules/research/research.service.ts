import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";

import { AppConfigService, PublicConfigStatus } from "../config/app-config.service";
import { DatabaseService } from "../database/database.service";
import { McpService } from "../mcp/mcp.service";
import { XhsStatusResponse } from "../mcp/mcp.types";
import { AmapProviderService } from "../providers/amap.service";
import { ProviderError } from "../providers/provider.types";
import { TavilyProviderService } from "../providers/tavily.service";
import { TripsService } from "../trips/trips.service";
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
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(TripsService) private readonly tripsService: TripsService,
    @Inject(AppConfigService) private readonly config: AppConfigService,
    @Inject(McpService) private readonly mcpService: McpService,
    @Inject(AmapProviderService) private readonly amap: AmapProviderService,
    @Inject(TavilyProviderService) private readonly tavily: TavilyProviderService
  ) {}

  async startResearch(tripId: string): Promise<AgentRun> {
    const trip = await this.tripsService.getTrip(tripId);

    const runId = randomUUID();
    const initialChecks = this.emptyChecks();
    await this.insertRun(runId, tripId, "running", "created", "研究任务已创建。", null, initialChecks);

    const configChecks = this.createConfigChecks(this.config.publicStatus);
    const missingProviders = Object.entries(configChecks)
      .filter(([provider, check]) => provider !== "xiaohongshu" && check.status === "missing")
      .map(([provider]) => provider);

    if (missingProviders.length > 0) {
      return this.updateRun(runId, {
        status: "blocked_config",
        stage: "config_check",
        summary: "研究任务因外部 provider 配置缺失而暂停。",
        errorMessage: `缺少配置：${missingProviders.join(", ")}`,
        checks: {
          ...configChecks,
          xiaohongshu: {
            status: "skipped",
            message: "provider 配置补齐后再检查小红书登录状态。"
          }
        },
        completed: true
      });
    }

    const xhsStatus = await this.mcpService.getXhsStatus();
    const checks = {
      ...configChecks,
      xiaohongshu: this.createXhsCheck(xhsStatus)
    };

    if (checks.xiaohongshu.status === "waiting" || checks.xiaohongshu.status === "unavailable") {
      return this.updateRun(runId, {
        status: "waiting_login",
        stage: "xhs_login",
        summary: "研究任务正在等待小红书 MCP 可用或完成登录。",
        errorMessage: checks.xiaohongshu.message,
        checks
      });
    }

    await this.updateRun(runId, {
      status: "running",
      stage: "source_research",
      summary: "预检已通过，正在采集小红书、地图和网页来源。",
      errorMessage: null,
      checks
    });

    const failures: string[] = [];
    await this.collectXhsSources(runId, trip, failures);
    await this.collectAmapSources(runId, trip, failures);
    await this.collectTavilySources(runId, trip, failures);

    return this.updateRun(runId, {
      status: failures.length === 3 ? "failed" : "completed",
      stage: "completed",
      summary:
        failures.length === 0
          ? "来源研究已完成。"
          : `来源研究完成，但部分 provider 不可用：${failures.join("、")}`,
      errorMessage: failures.length > 0 ? failures.join("；") : null,
      checks,
      completed: true
    });
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
        ORDER BY agent_runs.created_at DESC
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
      `SELECT * FROM research_sources WHERE run_id = (
        SELECT id FROM agent_runs WHERE trip_id = $1 ORDER BY created_at DESC LIMIT 1
      ) ORDER BY created_at ASC`,
      [tripId]
    );
    return result.rows.map((row) => this.toSource(row));
  }

  private async collectXhsSources(
    runId: string,
    trip: Awaited<ReturnType<TripsService["getTrip"]>>,
    failures: string[]
  ): Promise<void> {
    try {
      const items = await this.searchXhsWithFallback(trip.destination, trip.interests);
      for (const item of items) {
        await this.insertSource(runId, "xiaohongshu", item.title, item.url, item.snippet, item.metadata);
      }
      if (items.length === 0) {
        failures.push("小红书：候选关键词均未返回笔记");
      }
    } catch (error) {
      failures.push(`小红书：${safeError(error)}`);
    }
  }

  private async searchXhsWithFallback(destination: string, interests: string[]): Promise<ReturnType<typeof extractItems>> {
    const normalizedDestination = normalizeDestination(destination);
    const queries = uniqueStrings([
      normalizedDestination,
      `${normalizedDestination} 旅行`,
      ...interests.map((interest) => `${normalizedDestination} ${interest}`)
    ]);

    for (const query of queries) {
      const result = await this.mcpService.searchXhs(query);
      const items = extractItems(result);
      if (items.length > 0) {
        return items.slice(0, 5);
      }
    }

    return [];
  }

  private async collectAmapSources(
    runId: string,
    trip: Awaited<ReturnType<TripsService["getTrip"]>>,
    failures: string[]
  ): Promise<void> {
    try {
      const places = await this.amap.searchPlaces({
        keywords: trip.interests.join(" "),
        city: trip.destination,
        limit: 5
      });
      for (const place of places) {
        await this.insertSource(
          runId,
          "amap",
          place.name,
          null,
          place.address,
          { id: place.id, city: place.city, location: place.location }
        );
      }
    } catch (error) {
      failures.push(`高德：${safeError(error)}`);
    }
  }

  private async collectTavilySources(
    runId: string,
    trip: Awaited<ReturnType<TripsService["getTrip"]>>,
    failures: string[]
  ): Promise<void> {
    try {
      const result = await this.tavily.search({
        query: `${trip.destination} ${trip.interests.join(" ")} 旅行攻略 开放时间 门票`,
        maxResults: 5
      });
      for (const item of result.results) {
        await this.insertSource(runId, "tavily", item.title, item.url || null, item.content, { score: item.score });
      }
    } catch (error) {
      failures.push(`Tavily：${safeError(error)}`);
    }
  }

  private async insertSource(
    runId: string,
    provider: "xiaohongshu" | "amap" | "tavily",
    title: string,
    url: string | null,
    snippet: string | null,
    metadata: Record<string, unknown>
  ): Promise<void> {
    await this.database.query(
      `INSERT INTO research_sources (id, run_id, provider, title, url, snippet, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
      [randomUUID(), runId, provider, title.slice(0, 300), url, snippet?.slice(0, 2000) ?? null, JSON.stringify(metadata)]
    );
  }

  private async insertRun(
    id: string,
    tripId: string,
    status: AgentRunStatus,
    stage: AgentRunStage,
    summary: string,
    errorMessage: string | null,
    checks: AgentRunChecks
  ): Promise<void> {
    await this.database.query(
      `
        INSERT INTO agent_runs (
          id,
          trip_id,
          status,
          stage,
          summary,
          error_message,
          checks
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
      `,
      [id, tripId, status, stage, summary, errorMessage, JSON.stringify(checks)]
    );
  }

  private async updateRun(
    id: string,
    input: {
      status: AgentRunStatus;
      stage: AgentRunStage;
      summary: string;
      errorMessage: string | null;
      checks: AgentRunChecks;
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
          updated_at = now(),
          completed_at = CASE WHEN $7 THEN now() ELSE completed_at END
        WHERE id = $1
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
        Boolean(input.completed)
      ]
    );

    return this.toAgentRun(result.rows[0]);
  }

  private createConfigChecks(status: PublicConfigStatus): AgentRunChecks {
    return {
      llm: this.configCheck(status.llm, "LLM 已配置。", "LLM_API_KEY 未配置。"),
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
        message: "小红书 MCP 未配置，本轮跳过小红书来源。"
      };
    }

    if (status.connectionStatus === "unavailable") {
      return {
        status: "unavailable",
        message: status.errorMessage ?? "小红书 MCP 暂不可用。"
      };
    }

    if (status.loginStatus === "logged_out") {
      return {
        status: "waiting",
        message: "小红书 MCP 已连接，但账号未登录。"
      };
    }

    return {
      status: "passed",
      message:
        status.loginStatus === "logged_in"
          ? "小红书 MCP 已连接且已登录。"
          : "小红书 MCP 已连接，登录状态未知。"
    };
  }

  private emptyChecks(): AgentRunChecks {
    const skipped = {
      status: "skipped" as const,
      message: "等待检查。"
    };

    return {
      llm: skipped,
      amap: skipped,
      tavily: skipped,
      xiaohongshu: skipped
    };
  }

  private toAgentRun(row: AgentRunRow): AgentRun {
    const checks = typeof row.checks === "string" ? JSON.parse(row.checks) : row.checks;

    return {
      id: row.id,
      tripId: row.trip_id,
      status: row.status,
      stage: row.stage,
      summary: row.summary,
      errorMessage: row.error_message,
      checks,
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
      metadata: typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata,
      createdAt: row.created_at.toISOString()
    };
  }
}

function extractItems(value: unknown): Array<{ title: string; url: string | null; snippet: string | null; metadata: Record<string, unknown> }> {
  const candidates = Array.isArray(value)
    ? value
    : typeof value === "object" && value !== null
      ? Object.values(value as Record<string, unknown>).find(Array.isArray) ?? [value]
      : [value];

  return candidates
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => {
      const noteCard = isRecord(item.noteCard) ? item.noteCard : item;
      const user = isRecord(noteCard.user) ? noteCard.user : null;
      const id = stringValue(item.id) ?? stringValue(item.note_id);
      const title = stringValue(noteCard.displayTitle) ?? stringValue(item.title) ?? stringValue(item.name) ?? "小红书旅行来源";
      const snippet = stringValue(noteCard.desc) ?? stringValue(item.desc) ?? stringValue(item.content);

      return {
        title,
        url: stringValue(item.url) ?? (id ? `https://www.xiaohongshu.com/explore/${id}` : null),
        snippet,
        metadata: {
          id,
          xsecToken: stringValue(item.xsecToken),
          author: user ? stringValue(user.nickname) ?? stringValue(user.nickName) : stringValue(item.author)
        }
      };
    });
}

function normalizeDestination(destination: string): string {
  const aliases: Record<string, string> = {
    dali: "大理",
    "da li": "大理",
    hangzhou: "杭州",
    chengdu: "成都",
    beijing: "北京",
    shanghai: "上海",
    kunming: "昆明",
    lijiang: "丽江"
  };
  return aliases[destination.trim().toLowerCase()] ?? destination.trim();
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function safeError(error: unknown): string {
  if (error instanceof ProviderError) {
    return error.message;
  }
  return error instanceof Error ? error.message : "未知错误";
}
