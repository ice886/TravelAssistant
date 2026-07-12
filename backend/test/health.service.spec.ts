import { afterEach, describe, expect, it } from "vitest";

import { AppConfigService } from "../src/modules/config/app-config.service";
import { HealthService } from "../src/modules/health/health.service";

describe("HealthService", () => {
  afterEach(() => {
    delete process.env.LLM_API_KEY;
    delete process.env.LLM_MODEL;
  });
  it("returns health without exposing secret values", () => {
    process.env.LLM_API_KEY = "secret-value";
    process.env.LLM_MODEL = "test-model";

    const service = new HealthService(new AppConfigService());
    const payload = service.getHealth();

    expect(payload.status).toBe("ok");
    expect(payload.config.llm).toBe("configured");
    expect(JSON.stringify(payload)).not.toContain("secret-value");
  });
});
