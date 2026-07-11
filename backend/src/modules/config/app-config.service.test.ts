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
});
