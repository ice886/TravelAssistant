import { describe, expect, it, vi } from "vitest";

import { DatabaseService } from "../database/database.service";
import { LlmProviderService } from "../providers/llm.service";
import { TripsService } from "../trips/trips.service";
import { validateItinerary } from "./itinerary.validator";
import { PlannerService } from "./planner.service";

const content = {
  title: "杭州三日行程",
  summary: "西湖与美食主题行程",
  currency: "CNY",
  totalEstimatedCost: 1200,
  days: [{ day: 1, date: null, title: "西湖", notes: ["穿舒适鞋"], activities: [{
    time: "09:00", title: "游览西湖", location: "西湖", description: "步行游览", transport: "步行",
    estimatedCost: 0, sourceIds: ["source-1"]
  }] }],
  tips: ["价格为估算"]
};

describe("validateItinerary", () => {
  it("accepts a complete itinerary with known source ids", () => {
    expect(validateItinerary(content, new Set(["source-1"]))).toEqual(content);
  });

  it("removes unknown source references without rejecting the itinerary", () => {
    const contentWithUnknownSources = {
      ...content,
      days: [
        {
          ...content.days[0],
          activities: [
            {
              ...content.days[0].activities[0],
              sourceIds: ["source-1", "unknown-source", "source-1"]
            }
          ]
        }
      ]
    };

    const result = validateItinerary(contentWithUnknownSources, new Set(["source-1"]));

    expect(result.days[0].activities[0].sourceIds).toEqual(["source-1"]);
  });

  it("rejects incomplete content", () => {
    expect(() => validateItinerary({ title: "缺少字段" })).toThrow("Invalid itinerary content");
  });
});

describe("PlannerService", () => {
  it("generates and persists an itinerary from the latest research sources", async () => {
    const { service, database, llm } = createService({ sourcesAvailable: true });

    await expect(service.generate("trip-1")).resolves.toMatchObject({
      tripId: "trip-1",
      researchRunId: "run-1",
      version: 1,
      source: "generated",
      content
    });
    expect(llm.completeJson).toHaveBeenCalledWith(
      expect.objectContaining({ schemaName: "travel_itinerary" })
    );
    expect(llm.completeJson).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [
          expect.objectContaining({
            content: expect.stringContaining('"allowedSourceIds":["source-1"]')
          })
        ]
      })
    );
    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO itinerary_versions"),
      expect.arrayContaining(["trip-1", "run-1", "generated"])
    );
    const researchQuery = vi.mocked(database.query).mock.calls.find(([sql]) =>
      String(sql).includes("FROM research_sources")
    );
    expect(String(researchQuery?.[0])).toContain("status = 'completed'");
    expect(String(researchQuery?.[0])).toContain("EXISTS");
  });

  it("does not call the LLM when research sources are missing", async () => {
    const { service, llm } = createService({ sourcesAvailable: false });

    await expect(service.generate("trip-1")).rejects.toThrow(
      "Generate research sources before creating an itinerary."
    );
    expect(llm.completeJson).not.toHaveBeenCalled();
  });

  it("persists user edits as an edited version", async () => {
    const { service, database } = createService({ sourcesAvailable: true });

    await expect(service.save("trip-1", content)).resolves.toMatchObject({
      source: "edited",
      content
    });
    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO itinerary_versions"),
      expect.arrayContaining(["trip-1", null, "edited"])
    );
  });
});

function createService({ sourcesAvailable }: { sourcesAvailable: boolean }) {
  const database = {
    query: vi.fn((sql: string, values: unknown[] = []) => {
      if (sql.includes("FROM research_sources")) {
        return Promise.resolve({
          rows: sourcesAvailable
            ? [
                {
                  id: "source-1",
                  run_id: "run-1",
                  provider: "amap",
                  title: "西湖",
                  snippet: "杭州景点",
                  metadata: {}
                }
              ]
            : []
        });
      }

      if (sql.includes("INSERT INTO itinerary_versions")) {
        const [, tripId, runId, source, serializedContent] = values;

        return Promise.resolve({
          rows: [
            {
              id: "version-1",
              trip_id: tripId,
              research_run_id: runId,
              version: 1,
              source,
              content: JSON.parse(String(serializedContent)),
              created_at: new Date("2026-07-11T00:00:00.000Z")
            }
          ]
        });
      }

      return Promise.resolve({ rows: [] });
    })
  } as unknown as DatabaseService;
  const trips = {
    getTrip: vi.fn().mockResolvedValue({
      id: "trip-1",
      destination: "杭州",
      days: 1,
      interests: ["自然"],
      budgetLevel: "舒适",
      travelerType: "朋友",
      travelerCount: 2
    })
  } as unknown as TripsService;
  const llm = {
    completeJson: vi.fn().mockResolvedValue({ value: content })
  } as unknown as LlmProviderService;

  return {
    service: new PlannerService(database, trips, llm),
    database: database as unknown as { query: ReturnType<typeof vi.fn> },
    llm: llm as unknown as { completeJson: ReturnType<typeof vi.fn> }
  };
}
