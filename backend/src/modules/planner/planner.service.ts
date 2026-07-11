import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";

import { DatabaseService } from "../database/database.service";
import { LlmProviderService } from "../providers/llm.service";
import { Trip } from "../trips/trip.types";
import { TripsService } from "../trips/trips.service";
import { ITINERARY_SCHEMA } from "./itinerary.schema";
import { validateItinerary } from "./itinerary.validator";
import {
  ItineraryContent,
  ItineraryVersion,
  ItineraryVersionRow,
  PlannerResearchSourceRow
} from "./planner.types";

const GENERATION_INSTRUCTION =
  "请根据旅行需求和证据生成可执行的中文逐日行程。只引用提供的 sourceIds；预算为估算值。";

@Injectable()
export class PlannerService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(TripsService) private readonly trips: TripsService,
    @Inject(LlmProviderService) private readonly llm: LlmProviderService
  ) {}

  async generate(tripId: string): Promise<ItineraryVersion> {
    const trip = await this.trips.getTrip(tripId);
    const sources = await this.getLatestResearchSources(tripId);

    this.ensureSourcesExist(sources);

    const generatedValue = await this.generateContent(trip, sources);
    const allowedSourceIds = new Set(sources.map((source) => source.id));
    const content = validateItinerary(generatedValue, allowedSourceIds);

    return this.insertVersion({
      tripId,
      researchRunId: sources[0].run_id,
      source: "generated",
      content
    });
  }

  async getLatest(tripId: string): Promise<ItineraryVersion> {
    await this.trips.getTrip(tripId);

    const result = await this.database.query<ItineraryVersionRow>(
      `
        SELECT *
        FROM itinerary_versions
        WHERE trip_id = $1
        ORDER BY version DESC
        LIMIT 1
      `,
      [tripId]
    );
    const latestVersion = result.rows[0];

    if (!latestVersion) {
      throw new NotFoundException("Itinerary not found.");
    }

    return this.toVersion(latestVersion);
  }

  async save(tripId: string, input: unknown): Promise<ItineraryVersion> {
    await this.trips.getTrip(tripId);

    const content = validateItinerary(input);

    return this.insertVersion({
      tripId,
      researchRunId: null,
      source: "edited",
      content
    });
  }

  private async getLatestResearchSources(tripId: string): Promise<PlannerResearchSourceRow[]> {
    const result = await this.database.query<PlannerResearchSourceRow>(
      `
        SELECT id, run_id, provider, title, snippet, metadata
        FROM research_sources
        WHERE run_id = (
          SELECT id
          FROM agent_runs
          WHERE trip_id = $1
          ORDER BY created_at DESC
          LIMIT 1
        )
        ORDER BY created_at ASC
      `,
      [tripId]
    );

    return result.rows;
  }

  private ensureSourcesExist(sources: PlannerResearchSourceRow[]): void {
    if (sources.length === 0) {
      throw new BadRequestException(
        "Generate research sources before creating an itinerary."
      );
    }
  }

  private async generateContent(
    trip: Trip,
    sources: PlannerResearchSourceRow[]
  ): Promise<unknown> {
    const response = await this.llm.completeJson<unknown>({
      schemaName: "travel_itinerary",
      schema: ITINERARY_SCHEMA,
      messages: [
        {
          role: "user",
          content: JSON.stringify({
            instruction: GENERATION_INSTRUCTION,
            allowedSourceIds: sources.map((source) => source.id),
            trip,
            sources: sources.map(toPromptSource)
          })
        }
      ],
      temperature: 0.2
    });

    return response.value;
  }

  private async insertVersion(input: {
    tripId: string;
    researchRunId: string | null;
    source: "generated" | "edited";
    content: ItineraryContent;
  }): Promise<ItineraryVersion> {
    const result = await this.database.query<ItineraryVersionRow>(
      `
        INSERT INTO itinerary_versions (
          id,
          trip_id,
          research_run_id,
          version,
          source,
          content
        )
        VALUES (
          $1,
          $2,
          $3,
          COALESCE(
            (SELECT MAX(version) + 1 FROM itinerary_versions WHERE trip_id = $2),
            1
          ),
          $4,
          $5::jsonb
        )
        RETURNING *
      `,
      [
        randomUUID(),
        input.tripId,
        input.researchRunId,
        input.source,
        JSON.stringify(input.content)
      ]
    );

    return this.toVersion(result.rows[0]);
  }

  private toVersion(row: ItineraryVersionRow): ItineraryVersion {
    const content =
      typeof row.content === "string" ? JSON.parse(row.content) : row.content;

    return {
      id: row.id,
      tripId: row.trip_id,
      researchRunId: row.research_run_id,
      version: row.version,
      source: row.source,
      content,
      createdAt: row.created_at.toISOString()
    };
  }
}

function toPromptSource(source: PlannerResearchSourceRow) {
  return {
    id: source.id,
    provider: source.provider,
    title: source.title,
    snippet: source.snippet,
    metadata: source.metadata
  };
}
