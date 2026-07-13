import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";

import { DatabaseService } from "../src/modules/infrastructure/database/database.service";
import { TripRepository } from "../src/modules/persistence/trip.repository";

function createService() {
  const database = {
    query: async () => ({
      rows: [
        {
          id: "64d6d7dc-4632-4674-8ea1-e880e8395435",
          destination: "Hangzhou",
          start_date: null,
          end_date: null,
          days: 3,
          interests: ["food"],
          budget_level: "comfortable",
          traveler_type: "friends",
          traveler_count: 2,
          status: "draft",
          created_at: new Date("2026-07-09T00:00:00.000Z"),
          updated_at: new Date("2026-07-09T00:00:00.000Z")
        }
      ]
    })
  } as unknown as DatabaseService;

  return new TripRepository(database);
}

describe("TripRepository", () => {
  it("creates a trip from valid input", async () => {
    const service = createService();

    const trip = await service.createTrip({
      destination: " Hangzhou ",
      days: 3,
      interests: ["food"],
      budgetLevel: "comfortable",
      travelerType: "friends",
      travelerCount: 2
    });

    expect(trip.destination).toBe("Hangzhou");
    expect(trip.status).toBe("draft");
  });

  it("requires either days or startDate", async () => {
    const service = createService();

    await expect(
      service.createTrip({
        destination: "Hangzhou",
        interests: ["food"],
        budgetLevel: "comfortable",
        travelerType: "friends"
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
