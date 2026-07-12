import { Trip } from "../trips/trip.types";

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

export type ResearchAgentDecision =
  | {
      action: "call_tool";
      tool: ResearchToolName;
      input: ResearchToolInput;
    }
  | {
      action: "finish";
      summary: string;
    };

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

export interface ResearchAgentInput {
  trip: Trip;
  availableTools: ResearchToolName[];
  maxRounds: number;
  degradationReasons: string[];
  onProgress: (update: ResearchAgentProgressUpdate) => Promise<void>;
}

export interface ResearchAgentProgressUpdate {
  progress: ResearchAgentProgress;
  newSources: ResearchSourceDraft[];
}

export interface ResearchAgentResult {
  summary: string;
  sources: ResearchSourceDraft[];
  progress: ResearchAgentProgress;
}

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
