import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { DatabaseService } from "../infrastructure/database/database.service";
import { AgentRun, AgentRunChecks, AgentRunRow, AgentRunStage, AgentRunStatus } from "./research.types";
import { ResearchAgentProgress } from "../agents/research/research.agent.types";

@Injectable()
export class AgentRunRepository {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  async create(id: string, tripId: string, status: AgentRunStatus, stage: AgentRunStage, summary: string, errorMessage: string | null, checks: AgentRunChecks, progress: ResearchAgentProgress): Promise<AgentRun | null> {
    const result = await this.database.query<AgentRunRow>(`INSERT INTO agent_runs (id, trip_id, status, stage, summary, error_message, checks, progress) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb) ON CONFLICT (trip_id) WHERE status = 'running' DO NOTHING RETURNING *, 0 AS source_count`, [id, tripId, status, stage, summary, errorMessage, JSON.stringify(checks), JSON.stringify(progress)]);
    return result.rows[0] ? this.toAgentRun(result.rows[0]) : null;
  }

  async findActiveRun(tripId: string): Promise<AgentRun | null> {
    const result = await this.database.query<AgentRunRow>(`SELECT agent_runs.*, COUNT(research_sources.id) AS source_count FROM agent_runs LEFT JOIN research_sources ON research_sources.run_id = agent_runs.id WHERE agent_runs.trip_id = $1 AND agent_runs.status = 'running' GROUP BY agent_runs.id ORDER BY agent_runs.created_at DESC, agent_runs.id DESC LIMIT 1`, [tripId]);
    return result.rows[0] ? this.toAgentRun(result.rows[0]) : null;
  }

  async expireStaleRuns(tripId: string, staleBefore: Date): Promise<void> {
    await this.database.query(`UPDATE agent_runs SET status = 'failed', stage = 'completed', summary = '上一次进程内研究任务已超时终止。', error_message = 'STALE_IN_PROCESS_RUN', updated_at = now(), completed_at = now() WHERE trip_id = $1 AND status = 'running' AND updated_at < $2`, [tripId, staleBefore]);
  }

  async getLatestRun(tripId: string): Promise<AgentRun> {
    const result = await this.database.query<AgentRunRow>(`SELECT agent_runs.*, COUNT(research_sources.id) AS source_count FROM agent_runs LEFT JOIN research_sources ON research_sources.run_id = agent_runs.id WHERE agent_runs.trip_id = $1 GROUP BY agent_runs.id ORDER BY agent_runs.created_at DESC, agent_runs.id DESC LIMIT 1`, [tripId]);
    if (!result.rows[0]) throw new NotFoundException("Research run not found.");
    return this.toAgentRun(result.rows[0]);
  }

  async update(id: string, input: { status: AgentRunStatus; stage: AgentRunStage; summary: string; errorMessage: string | null; checks: AgentRunChecks; progress: ResearchAgentProgress; completed?: boolean }): Promise<AgentRun> {
    const result = await this.database.query<AgentRunRow>(`UPDATE agent_runs SET status = $2, stage = $3, summary = $4, error_message = $5, checks = $6::jsonb, progress = $7::jsonb, updated_at = now(), completed_at = CASE WHEN $8 THEN now() ELSE completed_at END WHERE id = $1 AND status = 'running' RETURNING *, (SELECT COUNT(*) FROM research_sources WHERE research_sources.run_id = agent_runs.id) AS source_count`, [id, input.status, input.stage, input.summary, input.errorMessage, JSON.stringify(input.checks), JSON.stringify(input.progress), Boolean(input.completed)]);
    if (!result.rows[0]) throw new Error("Research run is no longer active.");
    return this.toAgentRun(result.rows[0]);
  }

  async markUnexpectedFailure(id: string, error: unknown): Promise<void> {
    await this.database.query(`UPDATE agent_runs SET status = 'failed', stage = 'completed', summary = 'Research Agent 执行期间发生内部错误。', error_message = $2, updated_at = now(), completed_at = now() WHERE id = $1`, [id, error instanceof Error ? error.message : "未知错误"]);
  }

  private toAgentRun(row: AgentRunRow): AgentRun {
    const checks = normalizeChecks(parseJson<AgentRunChecks>(row.checks, emptyChecks()), emptyChecks());
    const progress = normalizeProgress(parseJson<ResearchAgentProgress>(row.progress, emptyProgress()), emptyProgress());
    return { id: row.id, tripId: row.trip_id, status: row.status, stage: row.stage, summary: row.summary, errorMessage: row.error_message, checks, progress, sourceCount: Number(row.source_count ?? 0), createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString(), completedAt: row.completed_at?.toISOString() ?? null };
  }
}

function parseJson<T>(value: T | string | undefined, fallback: T): T { if (typeof value !== "string") return value ?? fallback; try { return JSON.parse(value) as T; } catch { return fallback; } }
function emptyChecks(): AgentRunChecks { return { llm: { status: "skipped", message: "等待检查。" }, amap: { status: "skipped", message: "等待检查。" }, tavily: { status: "skipped", message: "等待检查。" }, xiaohongshu: { status: "skipped", message: "等待检查。" } }; }
function emptyProgress(): ResearchAgentProgress { return { currentRound: 0, maxRounds: 8, degraded: false, degradationReasons: [], toolCalls: [] }; }
function normalizeChecks(value: unknown, fallback: AgentRunChecks): AgentRunChecks { if (!isRecord(value)) return fallback; return { llm: isCheck(value.llm) ? value.llm : fallback.llm, amap: isCheck(value.amap) ? value.amap : fallback.amap, tavily: isCheck(value.tavily) ? value.tavily : fallback.tavily, xiaohongshu: isCheck(value.xiaohongshu) ? value.xiaohongshu : fallback.xiaohongshu }; }
function normalizeProgress(value: unknown, fallback: ResearchAgentProgress): ResearchAgentProgress { if (!isRecord(value)) return fallback; return { currentRound: numberValue(value.currentRound) ?? fallback.currentRound, maxRounds: numberValue(value.maxRounds) ?? fallback.maxRounds, degraded: typeof value.degraded === "boolean" ? value.degraded : fallback.degraded, degradationReasons: Array.isArray(value.degradationReasons) ? value.degradationReasons.filter((item): item is string => typeof item === "string") : fallback.degradationReasons, toolCalls: Array.isArray(value.toolCalls) ? value.toolCalls.filter(isToolCall) : fallback.toolCalls }; }
function isCheck(value: unknown): value is AgentRunChecks["llm"] { return isRecord(value) && typeof value.status === "string" && typeof value.message === "string"; }
function isToolCall(value: unknown): value is ResearchAgentProgress["toolCalls"][number] { return isRecord(value) && numberValue(value.round) !== null && typeof value.tool === "string" && ["completed", "failed", "skipped"].includes(String(value.status)) && typeof value.inputSummary === "string" && typeof value.observationSummary === "string" && numberValue(value.sourceCount) !== null; }
function numberValue(value: unknown): number | null { return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null; }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
