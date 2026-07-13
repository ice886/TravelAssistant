import { describe, expect, it } from "vitest";

import { AppConfigService } from "../infrastructure/config/app-config.service";
import { SafetyService } from "./safety.service";

function createSafetyService(readonlyTools = ["check_login_status", "search_feeds"]): SafetyService {
  return new SafetyService({
    xhsReadonlyTools: readonlyTools
  } as AppConfigService);
}

describe("SafetyService", () => {
  it("allows tools from the Xiaohongshu read-only whitelist", () => {
    const service = createSafetyService();

    expect(service.isXhsToolAllowed("search_feeds")).toEqual({
      allowed: true,
      reason: "Tool is allowed by the Xiaohongshu read-only whitelist."
    });
  });

  it("blocks destructive Xiaohongshu tools even when they are configured", () => {
    const service = createSafetyService(["delete_cookies", "search_feeds"]);

    expect(service.isXhsToolAllowed("delete_cookies").allowed).toBe(false);
  });

  it("blocks tools outside the read-only whitelist", () => {
    const service = createSafetyService();

    expect(service.isXhsToolAllowed("publish_content").allowed).toBe(false);
    expect(service.isXhsToolAllowed("unknown_tool").allowed).toBe(false);
  });
});
