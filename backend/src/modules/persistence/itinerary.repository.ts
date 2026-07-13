import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";

import { DatabaseService } from "../infrastructure/database/database.service";
import { ItineraryContent, ItineraryVersion, ItineraryVersionRow } from "./planner.types";

@Injectable()
export class ItineraryRepository {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  async getLatest(tripId: string): Promise<ItineraryVersion> {
    const result = await this.database.query<ItineraryVersionRow>("SELECT * FROM itinerary_versions WHERE trip_id = $1 ORDER BY version DESC LIMIT 1", [tripId]);
    if (!result.rows[0]) throw new NotFoundException("Itinerary not found.");
    return this.toVersion(result.rows[0]);
  }

  async insertVersion(input: { tripId: string; researchRunId: string | null; source: "generated" | "edited"; content: ItineraryContent }): Promise<ItineraryVersion> {
    const result = await this.database.query<ItineraryVersionRow>(`INSERT INTO itinerary_versions (id, trip_id, research_run_id, version, source, content) VALUES ($1, $2, $3, COALESCE((SELECT MAX(version) + 1 FROM itinerary_versions WHERE trip_id = $2), 1), $4, $5::jsonb) RETURNING *`, [randomUUID(), input.tripId, input.researchRunId, input.source, JSON.stringify(input.content)]);
    return this.toVersion(result.rows[0]);
  }

  private toVersion(row: ItineraryVersionRow): ItineraryVersion {
    return { id: row.id, tripId: row.trip_id, researchRunId: row.research_run_id, version: row.version, source: row.source, content: typeof row.content === "string" ? JSON.parse(row.content) : row.content, createdAt: row.created_at.toISOString() };
  }
}
