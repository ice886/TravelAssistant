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
      timeoutMs: this.positiveNumber("LLM_TIMEOUT_MS", 30000)
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

  get publicStatus(): PublicConfigStatus {
    return {
      nodeEnv: this.nodeEnv,
      apiPort: this.apiPort,
      webOrigin: this.webOrigin,
      database: this.statusOf("DATABASE_URL"),
      xiaohongshuMcp: this.statusOf("XHS_MCP_URL"),
      llm: this.statusOf("LLM_API_KEY"),
      amap: this.statusOf("AMAP_API_KEY"),
      tavily: this.statusOf("TAVILY_API_KEY")
    };
  }

  private statusOf(name: string): ConfigStatus {
    return this.env[name] ? "configured" : "missing";
  }

  private positiveNumber(name: string, fallback: number): number {
    const value = Number(this.env[name]);

    return Number.isFinite(value) && value > 0 ? value : fallback;
  }
}

function withoutTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}
