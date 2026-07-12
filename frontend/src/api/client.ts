export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "/api";

export interface HealthResponse {
  status: string;
  service: string;
  config: {
    nodeEnv: string;
    apiPort: number;
    webOrigin: string;
    database: "configured" | "missing";
    xiaohongshuMcp: "configured" | "missing";
    llm: "configured" | "missing";
    amap: "configured" | "missing";
    tavily: "configured" | "missing";
  };
}

export interface XhsStatusResponse {
  configured: boolean;
  connectionStatus: "not_configured" | "connected" | "unavailable";
  loginStatus: "logged_in" | "logged_out" | "unknown";
  tools: Array<{
    name: string;
    allowed: boolean;
  }>;
  readonlyTools: string[];
  blockedTools: string[];
  errorMessage: string | null;
}

export interface XhsLoginQrcodeResponse {
  configured: boolean;
  connectionStatus: "not_configured" | "connected" | "unavailable";
  loginStatus: "logged_in" | "logged_out" | "unknown";
  qrcode: unknown;
  qrcodeText: string | null;
  imageMimeType: string | null;
  imageData: string | null;
  imageDataUrl: string | null;
  errorMessage: string | null;
}

export interface CreateTripPayload {
  destination: string;
  days?: number;
  startDate?: string;
  endDate?: string;
  interests: string[];
  budgetLevel: string;
  travelerType: string;
  travelerCount: number;
}

export interface Trip {
  id: string;
  destination: string;
  startDate: string | null;
  endDate: string | null;
  days: number | null;
  interests: string[];
  budgetLevel: string;
  travelerType: string;
  travelerCount: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

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

export type ResearchToolName =
  | "xhs_search"
  | "web_search"
  | "poi_search"
  | "get_weather"
  | "get_route";

export interface ResearchToolCallRecord {
  round: number;
  tool: ResearchToolName;
  status: "completed" | "failed" | "skipped";
  inputSummary: string;
  observationSummary: string;
  sourceCount: number;
}

export interface ResearchAgentProgress {
  currentRound: number;
  maxRounds: number;
  degraded: boolean;
  degradationReasons: string[];
  toolCalls: ResearchToolCallRecord[];
}

export interface AgentRun {
  id: string;
  tripId: string;
  status: AgentRunStatus;
  stage: AgentRunStage;
  summary: string | null;
  errorMessage: string | null;
  checks: {
    llm: AgentRunCheck;
    amap: AgentRunCheck;
    tavily: AgentRunCheck;
    xiaohongshu: AgentRunCheck;
  };
  progress: ResearchAgentProgress;
  sourceCount: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface ResearchSource {
  id: string;
  runId: string;
  provider: "xiaohongshu" | "amap" | "tavily";
  title: string;
  url: string | null;
  snippet: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface ItineraryActivity {
  time: string;
  title: string;
  location: string;
  description: string;
  transport: string;
  estimatedCost: number;
  sourceIds: string[];
}

export interface ItineraryContent {
  title: string;
  summary: string;
  currency: string;
  totalEstimatedCost: number;
  days: Array<{
    day: number;
    date: string | null;
    title: string;
    activities: ItineraryActivity[];
    notes: string[];
  }>;
  tips: string[];
}

export interface ItineraryVersion {
  id: string;
  tripId: string;
  researchRunId: string | null;
  version: number;
  source: "generated" | "edited";
  content: ItineraryContent;
  createdAt: string;
}

export async function getHealth(): Promise<HealthResponse> {
  const response = await fetch(`${apiBaseUrl}/health`);

  if (!response.ok) {
    throw new Error(`健康检查请求失败：${response.status}`);
  }

  return response.json();
}

export async function getXhsStatus(): Promise<XhsStatusResponse> {
  const response = await fetch(`${apiBaseUrl}/xhs/status`);

  if (!response.ok) {
    throw new Error(`小红书状态请求失败：${response.status}`);
  }

  return response.json();
}

export async function getXhsLoginQrcode(): Promise<XhsLoginQrcodeResponse> {
  const response = await fetch(`${apiBaseUrl}/xhs/login-qrcode`);

  if (!response.ok) {
    throw new Error(`小红书登录二维码请求失败：${response.status}`);
  }

  return response.json();
}

export async function createTrip(payload: CreateTripPayload): Promise<Trip> {
  const response = await fetch(`${apiBaseUrl}/trips`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const message = await readErrorMessage(response);
    throw new Error(message ?? `旅行计划请求失败：${response.status}`);
  }

  return response.json();
}

export async function startResearch(tripId: string): Promise<AgentRun> {
  const response = await fetch(`${apiBaseUrl}/trips/${tripId}/research`, {
    method: "POST"
  });

  if (!response.ok) {
    const message = await readErrorMessage(response);
    throw new Error(message ?? `研究任务启动失败：${response.status}`);
  }

  return normalizeAgentRun(await response.json());
}

export async function getLatestResearchRun(tripId: string): Promise<AgentRun> {
  const response = await fetch(`${apiBaseUrl}/trips/${tripId}/research-runs/latest`);

  if (!response.ok) {
    const message = await readErrorMessage(response);
    throw new Error(message ?? `研究任务状态请求失败：${response.status}`);
  }

  return normalizeAgentRun(await response.json());
}

export async function getResearchSources(tripId: string): Promise<ResearchSource[]> {
  const response = await fetch(`${apiBaseUrl}/trips/${tripId}/research-sources`);

  if (!response.ok) {
    const message = await readErrorMessage(response);
    throw new Error(message ?? `研究来源请求失败：${response.status}`);
  }

  return response.json();
}

export async function generateItinerary(tripId: string): Promise<ItineraryVersion> {
  const response = await fetch(`${apiBaseUrl}/trips/${tripId}/itineraries/generate`, { method: "POST" });
  if (!response.ok) throw new Error((await readErrorMessage(response)) ?? `行程生成失败：${response.status}`);
  return response.json();
}

export async function getLatestItinerary(tripId: string): Promise<ItineraryVersion> {
  const response = await fetch(`${apiBaseUrl}/trips/${tripId}/itineraries/latest`);
  if (!response.ok) throw new Error((await readErrorMessage(response)) ?? `行程读取失败：${response.status}`);
  return response.json();
}

export async function saveItinerary(tripId: string, content: ItineraryContent): Promise<ItineraryVersion> {
  const response = await fetch(`${apiBaseUrl}/trips/${tripId}/itineraries`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(content)
  });
  if (!response.ok) throw new Error((await readErrorMessage(response)) ?? `行程保存失败：${response.status}`);
  return response.json();
}

async function readErrorMessage(response: Response): Promise<string | null> {
  try {
    const payload = (await response.json()) as { message?: unknown };

    if (typeof payload.message === "string") {
      return payload.message;
    }
  } catch {
    return null;
  }

  return null;
}

function normalizeAgentRun(value: unknown): AgentRun {
  const run = isRecord(value) ? value : {};
  const rawProgress = isRecord(run.progress) ? run.progress : {};
  const toolCalls = Array.isArray(rawProgress.toolCalls)
    ? rawProgress.toolCalls.filter(isResearchToolCall)
    : [];
  const degradationReasons = Array.isArray(rawProgress.degradationReasons)
    ? rawProgress.degradationReasons.filter((item): item is string => typeof item === "string")
    : [];

  return {
    ...(run as unknown as AgentRun),
    progress: {
      currentRound: nonNegativeInteger(rawProgress.currentRound) ?? 0,
      maxRounds: positiveInteger(rawProgress.maxRounds) ?? 8,
      degraded: rawProgress.degraded === true,
      degradationReasons,
      toolCalls
    }
  };
}

function isResearchToolCall(value: unknown): value is ResearchToolCallRecord {
  if (!isRecord(value)) return false;
  return nonNegativeInteger(value.round) !== null
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
