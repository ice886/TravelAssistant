import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";

import { AppConfigService, PublicConfigStatus } from "../config/app-config.service";
import { DatabaseService } from "../database/database.service";
import { McpService } from "../mcp/mcp.service";
import { XhsStatusResponse } from "../mcp/mcp.types";
import { TripsService } from "../trips/trips.service";
import { AgentRun, AgentRunChecks, AgentRunRow, AgentRunStage, AgentRunStatus } from "./research.types";

@Injectable()
export class ResearchService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(TripsService) private readonly tripsService: TripsService,
    @Inject(AppConfigService) private readonly config: AppConfigService,
    @Inject(McpService) private readonly mcpService: McpService
  ) {}

  async startResearch(tripId: string): Promise<AgentRun> {
    await this.tripsService.getTrip(tripId);

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

    return this.updateRun(runId, {
      status: "completed",
      stage: "completed",
      summary: "研究预检已完成，后续可接入真实来源检索与行程生成。",
      errorMessage: null,
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
}
