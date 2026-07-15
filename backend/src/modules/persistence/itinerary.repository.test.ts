import { describe, expect, it, vi } from "vitest";

import { ItineraryRepository } from "./itinerary.repository";

describe("ItineraryRepository", () => {
  it("returns null when a trip has no itinerary versions", async () => {
    const database = {
      query: vi.fn().mockResolvedValue({ rows: [] })
    };
    const repository = new ItineraryRepository(database as never);

    await expect(repository.getLatest("trip-1")).resolves.toBeNull();
  });
});
