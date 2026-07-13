import { Trip } from "../../persistence/trip.types";
import { AgentContext, AgentDecision, AgentProgress, AgentResult, AgentProgressUpdate, ToolCallRecord } from "../../agent-core/agent-core.types";

export type ResearchToolName =
  | "xhs_search"
  | "web_search"
  | "poi_search"
  | "get_weather"
  | "get_route";

export type ResearchToolInput =
  | { query: string }
  | { keyword: string; city?: string }
  | { city: string }
  | {
      origin: string;
      destination: string;
      mode: "walking" | "driving" | "transit";
      city?: string;
    };

export type ResearchAgentDecision = AgentDecision & { tool?: ResearchToolName };

export type ResearchSourceProvider = "xiaohongshu" | "amap" | "tavily";

export interface ResearchSourceDraft {
  provider: ResearchSourceProvider;
  title: string;
  url: string | null;
  snippet: string | null;
  metadata: Record<string, unknown>;
}

export interface ResearchToolResult {
  observation: string;
  sources: ResearchSourceDraft[];
}

export type ResearchToolCallRecord = ToolCallRecord & { tool: ResearchToolName; sourceCount?: number };

export type ResearchAgentProgress = AgentProgress;

export interface ResearchAgentContext extends AgentContext {
  trip: Trip;
  availableTools: ResearchToolName[];
  maxRounds: number;
  degradationReasons: string[];
  collectedSourceKeys: Set<string>;
  collectedSources: ResearchSourceDraft[];
}

export type ResearchAgentProgressUpdate = AgentProgressUpdate & { newSources?: ResearchSourceDraft[] };

export type ResearchAgentResult = AgentResult & { sources: ResearchSourceDraft[] };

export const RESEARCH_DECISION_SCHEMA: Record<string, unknown> = {
  oneOf: [
    {
      type: "object",
      additionalProperties: false,
      required: ["action", "tool", "input"],
      properties: {
        action: { const: "call_tool" },
        tool: {
          enum: ["xhs_search", "web_search", "poi_search", "get_weather", "get_route"]
        },
        input: { type: "object" }
      }
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["action", "summary"],
      properties: {
        action: { const: "finish" },
        summary: { type: "string", minLength: 1, maxLength: 500 }
      }
    }
  ]
};
