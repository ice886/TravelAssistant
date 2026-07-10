export type AgentRunStatus =
  | "running"
  | "completed"
  | "blocked_config"
  | "waiting_login"
  | "failed";

export type AgentRunStage =
  | "created"
  | "config_check"
  | "xhs_login"
  | "source_research"
  | "completed";

export interface AgentRunCheck {
  status: "passed" | "missing" | "waiting" | "unavailable" | "skipped";
  message: string;
}

export interface AgentRunChecks {
  llm: AgentRunCheck;
  amap: AgentRunCheck;
  tavily: AgentRunCheck;
  xiaohongshu: AgentRunCheck;
}

export interface AgentRun {
  id: string;
  tripId: string;
  status: AgentRunStatus;
  stage: AgentRunStage;
  summary: string | null;
  errorMessage: string | null;
  checks: AgentRunChecks;
  sourceCount: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface AgentRunRow {
  id: string;
  trip_id: string;
  status: AgentRunStatus;
  stage: AgentRunStage;
  summary: string | null;
  error_message: string | null;
  checks: AgentRunChecks | string;
  source_count?: string | number;
  created_at: Date;
  updated_at: Date;
  completed_at: Date | null;
}

export type ResearchSourceProvider = "xiaohongshu" | "amap" | "tavily";

export interface ResearchSource {
  id: string;
  runId: string;
  provider: ResearchSourceProvider;
  title: string;
  url: string | null;
  snippet: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface ResearchSourceRow {
  id: string;
  run_id: string;
  provider: ResearchSourceProvider;
  title: string;
  url: string | null;
  snippet: string | null;
  metadata: Record<string, unknown> | string;
  created_at: Date;
}
