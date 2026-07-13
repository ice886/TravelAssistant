import { Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";

import { DatabaseService } from "../infrastructure/database/database.service";
import { ResearchSourceDraft } from "../agents/research/research.agent.types";
import { PlannerResearchSourceRow } from "./planner.types";
import { ResearchSource, ResearchSourceRow } from "./research.types";

@Injectable()
export class ResearchSourceRepository {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  async insert(runId: string, source: ResearchSourceDraft): Promise<void> {
    await this.database.query(`INSERT INTO research_sources (id, run_id, provider, title, url, snippet, metadata) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`, [randomUUID(), runId, source.provider, source.title.slice(0, 300), source.url, source.snippet?.slice(0, 2000) ?? null, JSON.stringify(source.metadata)]);
  }

  async getSources(tripId: string): Promise<ResearchSource[]> {
    const result = await this.database.query<ResearchSourceRow>(`SELECT * FROM research_sources WHERE run_id = (SELECT id FROM agent_runs WHERE trip_id = $1 ORDER BY created_at DESC, id DESC LIMIT 1) ORDER BY created_at ASC`, [tripId]);
    return result.rows.map((row) => this.toSource(row));
  }

  async getLatestResearchSources(tripId: string): Promise<PlannerResearchSourceRow[]> {
    const result = await this.database.query<PlannerResearchSourceRow>(`SELECT id, run_id, provider, title, snippet, metadata FROM research_sources WHERE run_id = (SELECT id FROM agent_runs WHERE trip_id = $1 AND status = 'completed' AND EXISTS (SELECT 1 FROM research_sources candidate_sources WHERE candidate_sources.run_id = agent_runs.id) ORDER BY created_at DESC, id DESC LIMIT 1) ORDER BY created_at ASC`, [tripId]);
    return result.rows;
  }

  private toSource(row: ResearchSourceRow): ResearchSource {
    return { id: row.id, runId: row.run_id, provider: row.provider, title: row.title, url: row.url, snippet: row.snippet, metadata: typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata, createdAt: row.created_at.toISOString() };
  }
}
