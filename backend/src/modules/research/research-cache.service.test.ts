import { describe, expect, it, vi } from "vitest";

import { DatabaseService } from "../database/database.service";
import { Trip } from "../trips/trip.types";
import { ResearchCacheService } from "./research-cache.service";

const trip: Trip = {
  id: "trip-1",
  destination: "杭州",
  startDate: "2026-08-01",
  endDate: "2026-08-03",
  days: 3,
  interests: ["美食", "古镇"],
  budgetLevel: "medium",
  travelerType: "couple",
  travelerCount: 2,
  status: "draft",
  createdAt: "2026-07-12T00:00:00.000Z",
  updatedAt: "2026-07-12T00:00:00.000Z"
};

function createService(query = vi.fn().mockResolvedValue({ rows: [] })) {
  return {
    service: new ResearchCacheService({ query } as unknown as DatabaseService),
    query
  };
}

describe("ResearchCacheService", () => {
  it("builds a stable key from normalized destination, interests, and duration", () => {
    const { service } = createService();
    const equivalentTrip: Trip = {
      ...trip,
      destination: "  杭州  ",
      interests: ["古镇", " 美食 ", "美食"]
    };

    expect(service.buildKey(equivalentTrip)).toBe(service.buildKey(trip));
    expect(service.buildKey({ ...trip, days: 4 })).not.toBe(service.buildKey(trip));
    expect(service.buildKey({ ...trip, budgetLevel: "high" })).not.toBe(service.buildKey(trip));
    expect(service.buildKey({ ...trip, travelerCount: 3 })).not.toBe(service.buildKey(trip));
    expect(service.buildKey(trip, ["amap:configured"])).not.toBe(
      service.buildKey(trip, ["amap:missing"])
    );
  });

  it("returns valid, unexpired source drafts and ignores malformed cache data", async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({
        rows: [{
          sources: {
            sources: [{ provider: "amap", title: "西湖", url: null, snippet: "杭州西湖", metadata: {} }],
            degraded: true,
            degradationReasons: ["小红书未配置"]
          },
          expires_at: new Date("2026-07-13T00:00:00.000Z")
        }]
      })
      .mockResolvedValueOnce({
        rows: [{ sources: [{ provider: "unknown", title: "bad" }], expires_at: new Date() }]
      });
    const { service } = createService(query);

    await expect(service.get("valid-key")).resolves.toEqual({
      sources: [{ provider: "amap", title: "西湖", url: null, snippet: "杭州西湖", metadata: {} }],
      degraded: true,
      degradationReasons: ["小红书未配置"]
    });
    await expect(service.get("bad-key")).resolves.toBeNull();
  });

  it("upserts cache entries with an explicit expiration", async () => {
    const { service, query } = createService();
    const before = Date.now();

    await service.set(
      "cache-key",
      [{ provider: "tavily", title: "攻略", url: null, snippet: null, metadata: {} }],
      60,
      true,
      ["小红书未配置"]
    );

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("ON CONFLICT (cache_key)"),
      expect.arrayContaining(["cache-key"])
    );
    const expiresAt = vi.mocked(query).mock.calls[0][1]?.[3];
    expect(expiresAt).toBeInstanceOf(Date);
    expect((expiresAt as Date).getTime()).toBeGreaterThanOrEqual(before + 59000);
    expect(String(vi.mocked(query).mock.calls[0][1]?.[2])).toContain('"degraded":true');
  });
});
