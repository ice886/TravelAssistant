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
        progress jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        completed_at timestamptz
      )
    `);

    await this.query(`
      ALTER TABLE agent_runs
      ADD COLUMN IF NOT EXISTS progress jsonb NOT NULL DEFAULT '{}'::jsonb
    `);

    await this.query(`
      WITH ranked_running AS (
        SELECT
          id,
          ROW_NUMBER() OVER (PARTITION BY trip_id ORDER BY created_at DESC, id DESC) AS position
        FROM agent_runs
        WHERE status = 'running'
      )
      UPDATE agent_runs
      SET
        status = 'failed',
        stage = 'completed',
        summary = '重复运行已在启动迁移中终止。',
        error_message = 'DUPLICATE_ACTIVE_RUN',
        updated_at = now(),
        completed_at = now()
      WHERE id IN (SELECT id FROM ranked_running WHERE position > 1)
    `);

    await this.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS agent_runs_one_running_per_trip_idx
      ON agent_runs (trip_id)
      WHERE status = 'running'
    `);

    await this.query(`
      CREATE INDEX IF NOT EXISTS agent_runs_trip_created_idx
      ON agent_runs (trip_id, created_at DESC, id DESC)
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
      CREATE INDEX IF NOT EXISTS research_sources_run_created_idx
      ON research_sources (run_id, created_at ASC)
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

    await this.query(`DROP TABLE IF EXISTS research_cache`);
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

