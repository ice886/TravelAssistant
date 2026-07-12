import { afterEach, describe, expect, it, vi } from "vitest";

import { AppConfigService } from "./app-config.service";

describe("AppConfigService", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses a 300 second default LLM timeout", () => {
    vi.stubEnv("LLM_TIMEOUT_MS", "");

    expect(new AppConfigService().llm.timeoutMs).toBe(300000);
  });

  it("allows the LLM timeout to be configured", () => {
    vi.stubEnv("LLM_TIMEOUT_MS", "180000");

    expect(new AppConfigService().llm.timeoutMs).toBe(180000);
  });

  it("requires both an LLM API key and model for public readiness", () => {
    vi.stubEnv("LLM_API_KEY", "test-key");
    vi.stubEnv("LLM_MODEL", "");
    expect(new AppConfigService().publicStatus.llm).toBe("missing");

    vi.stubEnv("LLM_MODEL", "test-model");
    expect(new AppConfigService().publicStatus.llm).toBe("configured");
  });

  it("uses positive research settings and caps Agent rounds at eight", () => {
    vi.stubEnv("RESEARCH_MAX_ROUNDS", "20");
    vi.stubEnv("RESEARCH_CACHE_TTL_SECONDS", "0.5");
    expect(new AppConfigService().research).toEqual({
      maxRounds: 8,
      cacheTtlSeconds: 604800,
      staleAfterSeconds: 3600
    });
  });

  it("treats whitespace-only provider settings as missing", () => {
    vi.stubEnv("LLM_API_KEY", "   ");
    vi.stubEnv("LLM_MODEL", " model ");
    vi.stubEnv("AMAP_API_KEY", "   ");
    vi.stubEnv("TAVILY_API_KEY", "   ");
    vi.stubEnv("XHS_MCP_URL", "   ");

    expect(new AppConfigService().publicStatus).toMatchObject({
      llm: "missing",
      amap: "missing",
      tavily: "missing",
      xiaohongshuMcp: "missing"
    });
  });
});
