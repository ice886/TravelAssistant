import { Injectable } from "@nestjs/common";

type ConfigStatus = "configured" | "missing";

export interface PublicConfigStatus {
  nodeEnv: string;
  apiPort: number;
  webOrigin: string;
  database: ConfigStatus;
  xiaohongshuMcp: ConfigStatus;
  llm: ConfigStatus;
  amap: ConfigStatus;
  tavily: ConfigStatus;
}

export interface LlmConfig {
  provider: string;
  baseUrl: string;
  apiKey: string | null;
  model: string | null;
  timeoutMs: number;
}

export interface AmapConfig {
  apiKey: string | null;
  baseUrl: string;
  timeoutMs: number;
}

export interface TavilyConfig {
  apiKey: string | null;
  baseUrl: string;
  timeoutMs: number;
}

export interface ResearchConfig {
  maxRounds: number;
  staleAfterSeconds: number;
}

@Injectable()
export class AppConfigService {
  private readonly env = process.env;

  get nodeEnv(): string {
    return this.env.NODE_ENV ?? "development";
  }

  get apiPort(): number {
    return Number(this.env.API_PORT ?? 3000);
  }

  get webOrigin(): string {
    return this.env.WEB_ORIGIN ?? `http://localhost:${this.env.WEB_PORT ?? 5173}`;
  }

  get databaseUrl(): string {
    return this.env.DATABASE_URL ?? "postgresql://travel_assistant:change-me@localhost:5432/travel_assistant";
  }

  get xhsMcpUrl(): string | null {
    return this.env.XHS_MCP_URL?.trim() || null;
  }

  get xhsMcpTimeoutMs(): number {
    return this.positiveNumber("XHS_MCP_TIMEOUT_MS", 15000);
  }

  get xhsReadonlyTools(): string[] {
    const configuredTools = this.env.XHS_READONLY_TOOLS?.trim();

    if (!configuredTools) {
      return [
        "check_login_status",
        "get_login_qrcode",
        "list_feeds",
        "search_feeds",
        "get_feed_detail",
        "user_profile"
      ];
    }

    return configuredTools
      .split(",")
      .map((tool) => tool.trim())
      .filter(Boolean);
  }

  get llm(): LlmConfig {
    return {
      provider: this.env.LLM_PROVIDER?.trim() || "openai-compatible",
      baseUrl: withoutTrailingSlash(this.env.LLM_BASE_URL?.trim() || "https://api.openai.com/v1"),
      apiKey: this.env.LLM_API_KEY?.trim() || null,
      model: this.env.LLM_MODEL?.trim() || null,
      timeoutMs: this.positiveNumber("LLM_TIMEOUT_MS", 300000)
    };
  }

  get amap(): AmapConfig {
    return {
      apiKey: this.env.AMAP_API_KEY?.trim() || null,
      baseUrl: withoutTrailingSlash(this.env.AMAP_BASE_URL?.trim() || "https://restapi.amap.com/v3"),
      timeoutMs: this.positiveNumber("AMAP_TIMEOUT_MS", 10000)
    };
  }

  get tavily(): TavilyConfig {
    return {
      apiKey: this.env.TAVILY_API_KEY?.trim() || null,
      baseUrl: withoutTrailingSlash(this.env.TAVILY_BASE_URL?.trim() || "https://api.tavily.com"),
      timeoutMs: this.positiveNumber("TAVILY_TIMEOUT_MS", 15000)
    };
  }

  get research(): ResearchConfig {
    return {
      maxRounds: this.positiveInteger("RESEARCH_MAX_ROUNDS", 8, 8),
      staleAfterSeconds: this.positiveInteger("RESEARCH_STALE_AFTER_SECONDS", 3600)
    };
  }

  get publicStatus(): PublicConfigStatus {
    const llm = this.llm;
    const amap = this.amap;
    const tavily = this.tavily;
    return {
      nodeEnv: this.nodeEnv,
      apiPort: this.apiPort,
      webOrigin: this.webOrigin,
      database: this.env.DATABASE_URL?.trim() ? "configured" : "missing",
      xiaohongshuMcp: this.xhsMcpUrl ? "configured" : "missing",
      llm: llm.apiKey && llm.model ? "configured" : "missing",
      amap: amap.apiKey ? "configured" : "missing",
      tavily: tavily.apiKey ? "configured" : "missing"
    };
  }

  private positiveNumber(name: string, fallback: number): number {
    const value = Number(this.env[name]);

    return Number.isFinite(value) && value > 0 ? value : fallback;
  }

  private positiveInteger(name: string, fallback: number, maximum?: number): number {
    const value = Math.floor(Number(this.env[name]));
    if (!Number.isFinite(value) || value < 1) {
      return fallback;
    }
    return maximum === undefined ? value : Math.min(value, maximum);
  }
}

function withoutTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

