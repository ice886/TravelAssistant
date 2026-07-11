import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Pool, QueryResult, QueryResultRow } from "pg";

import { AppConfigService } from "../config/app-config.service";

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly pool: Pool;

  constructor(@Inject(AppConfigService) config: AppConfigService) {
    this.pool = new Pool({
      connectionString: config.databaseUrl
    });
  }

  async onModuleInit(): Promise<void> {
    await this.query(`
      CREATE TABLE IF NOT EXISTS trips (
        id uuid PRIMARY KEY,
        destination text NOT NULL,
        start_date date,
        end_date date,
        days integer,
        interests jsonb NOT NULL DEFAULT '[]'::jsonb,
        budget_level text NOT NULL,
        traveler_type text NOT NULL,
        traveler_count integer NOT NULL DEFAULT 1,
        status text NOT NULL DEFAULT 'draft',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await this.query(`
      CREATE TABLE IF NOT EXISTS agent_runs (
        id uuid PRIMARY KEY,
        trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
        status text NOT NULL,
        stage text NOT NULL,
        summary text,
        error_message text,
        checks jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        completed_at timestamptz
      )
    `);

    await this.query(`
      CREATE TABLE IF NOT EXISTS research_sources (
        id uuid PRIMARY KEY,
        run_id uuid NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
        provider text NOT NULL,
        title text NOT NULL,
        url text,
        snippet text,
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await this.query(`
      CREATE TABLE IF NOT EXISTS itinerary_versions (
        id uuid PRIMARY KEY,
        trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
        research_run_id uuid REFERENCES agent_runs(id) ON DELETE SET NULL,
        version integer NOT NULL,
        source text NOT NULL,
        content jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (trip_id, version)
      )
    `);
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }

  async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values: unknown[] = []
  ): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, values);
  }
}
