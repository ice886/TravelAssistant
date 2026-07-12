import { describe, expect, it, vi } from "vitest";

import { McpService } from "../mcp/mcp.service";
import { AmapProviderService } from "../providers/amap.service";
import { TavilyProviderService } from "../providers/tavily.service";
import { Trip } from "../trips/trip.types";
import { ResearchToolsService } from "./research-tools.service";

const trip = {
  destination: "杭州"
} as Trip;

describe("ResearchToolsService", () => {
  it("normalizes XHS note cards without persisting transient tokens", async () => {
    const mcp = {
      searchXhs: vi.fn().mockResolvedValue({
        feeds: [{
          id: "note-1",
          xsecToken: "transient-secret",
          noteCard: {
            displayTitle: "杭州旅行攻略",
            desc: "第一次去杭州",
            user: { nickname: "旅行作者" }
          }
        }]
      })
    } as unknown as McpService;
    const service = new ResearchToolsService(
      mcp,
      {} as AmapProviderService,
      {} as TavilyProviderService
    );

    const result = await service.execute("xhs_search", { query: "杭州" }, trip);

    expect(result.sources[0]).toMatchObject({
      provider: "xiaohongshu",
      title: "杭州旅行攻略",
      url: "https://www.xiaohongshu.com/explore/note-1",
      metadata: { tool: "xhs_search", id: "note-1", author: "旅行作者" }
    });
    expect(JSON.stringify(result.sources)).not.toContain("transient-secret");
  });

  it("geocodes route endpoints before requesting a transit route", async () => {
    const amap = {
      geocode: vi.fn()
        .mockResolvedValueOnce([{ location: { longitude: 120.1, latitude: 30.1 } }])
        .mockResolvedValueOnce([{ location: { longitude: 120.2, latitude: 30.2 } }]),
      estimateRoute: vi.fn().mockResolvedValue({ distanceMeters: 12000, durationSeconds: 3600 })
    } as unknown as AmapProviderService;
    const service = new ResearchToolsService(
      {} as McpService,
      amap,
      {} as TavilyProviderService
    );

    const result = await service.execute(
      "get_route",
      { origin: "西湖", destination: "良渚", mode: "transit", city: "杭州" },
      trip
    );

    expect(amap.estimateRoute).toHaveBeenCalledWith(expect.objectContaining({
      strategy: "transit",
      city: "杭州"
    }));
    expect(result.sources[0]).toMatchObject({
      provider: "amap",
      metadata: { tool: "get_route", distanceMeters: 12000 }
    });
  });
});
