import { LlmMessage } from "../infrastructure/providers/provider.types";

export interface AgentContext {
  mode?: "react" | "generate";
  availableTools: string[];
  maxRounds: number;
  degradationReasons: string[];
  runtimeNotes?: string[];
  onProgress?: (update: AgentProgressUpdate) => Promise<void>;
}

export interface ToolCallRecord {
  round: number;
  tool: string;
  status: "completed" | "failed" | "skipped";
  inputSummary: string;
  observationSummary: string;
  sourceCount: number;
}

export interface AgentProgress {
  currentRound: number;
  maxRounds: number;
  degraded: boolean;
  degradationReasons: string[];
  toolCalls: ToolCallRecord[];
}

export type AgentDecision =
  | { action: "call_tool"; tool: string; input: unknown }
  | { action: "finish"; summary: string };

export interface AgentResult {
  summary: string;
  artifacts: unknown[];
  progress: AgentProgress;
}

export interface AgentProgressUpdate {
  progress: AgentProgress;
  newArtifacts: unknown[];
}

export type AgentMessages = LlmMessage[];
