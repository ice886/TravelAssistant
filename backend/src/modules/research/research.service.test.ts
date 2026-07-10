import { describe, expect, it, vi } from "vitest";

import { AppConfigService } from "../config/app-config.service";
import { DatabaseService } from "../database/database.service";
import { McpService } from "../mcp/mcp.service";
import { TripsService } from "../trips/trips.service";
import { ResearchService } from "./research.service";

function createService({
  publicStatus,
  xhsStatus
}: {
  publicStatus: AppConfigService["publicStatus"];
  xhsStatus: Awaited<ReturnType<McpService["getXhsStatus"]>>;
}) {
  const rows = new Map<string, Record<string, unknown>>();
  const database = {
    query: vi.fn((sql: string, values: unknown[] = []) => {
      if (sql.includes("INSERT INTO agent_runs")) {
        const [id, tripId, status, stage, summary, errorMessage, checks] = values;
        rows.set(String(id), {
          id,
          trip_id: tripId,
          status,
          stage,
          summary,
          error_message: errorMessage,
          checks: JSON.parse(String(checks)),
          source_count: 0,
          created_at: new Date("2026-07-09T00:00:00.000Z"),
          updated_at: new Date("2026-07-09T00:00:00.000Z"),
          completed_at: null
        });

        return Promise.resolve({ rows: [] });
      }

      if (sql.includes("UPDATE agent_runs")) {
        const [id, status, stage, summary, errorMessage, checks, completed] = values;
        const row = rows.get(String(id));

        if (!row) {
          return Promise.resolve({ rows: [] });
        }

        row.status = status;
        row.stage = stage;
        row.summary = summary;
        row.error_message = errorMessage;
        row.checks = JSON.parse(String(checks));
        row.updated_at = new Date("2026-07-09T00:01:00.000Z");
        row.completed_at = completed ? new Date("2026-07-09T00:01:00.000Z") : null;

        return Promise.resolve({ rows: [row] });
      }

      return Promise.resolve({ rows: [] });
    })
  } as unknown as DatabaseService;
  const tripsService = {
    getTrip: vi.fn().mockResolvedValue({
      id: "trip-1",
      destination: "杭州"
    })
  } as unknown as TripsService;
  const config = {
    publicStatus
  } as AppConfigService;
  const mcpService = {
    getXhsStatus: vi.fn().mockResolvedValue(xhsStatus)
  } as unknown as McpService;

  return {
    service: new ResearchService(database, tripsService, config, mcpService),
    database,
    mcpService
  };
}

const configuredStatus: AppConfigService["publicStatus"] = {
  nodeEnv: "test",
  apiPort: 3000,
  webOrigin: "http://localhost:5173",
  database: "configured",
  xiaohongshuMcp: "configured",
  llm: "configured",
  amap: "configured",
  tavily: "configured"
};

const loggedInXhsStatus: Awaited<ReturnType<McpService["getXhsStatus"]>> = {
  configured: true,
  connectionStatus: "connected",
  loginStatus: "logged_in",
  tools: [],
  readonlyTools: [],
  blockedTools: [],
  errorMessage: null
};

describe("ResearchService", () => {
  it("blocks a run when required providers are missing", async () => {
    const { service, mcpService } = createService({
      publicStatus: {
        ...configuredStatus,
        llm: "missing",
        tavily: "missing"
      },
      xhsStatus: loggedInXhsStatus
    });

    const run = await service.startResearch("00000000-0000-4000-8000-000000000001");

    expect(run.status).toBe("blocked_config");
    expect(run.stage).toBe("config_check");
    expect(run.errorMessage).toContain("llm");
    expect(run.errorMessage).toContain("tavily");
    expect(mcpService.getXhsStatus).not.toHaveBeenCalled();
  });

  it("waits when Xiaohongshu MCP is connected but logged out", async () => {
    const { service } = createService({
      publicStatus: configuredStatus,
      xhsStatus: {
        ...loggedInXhsStatus,
        loginStatus: "logged_out"
      }
    });

    const run = await service.startResearch("00000000-0000-4000-8000-000000000001");

    expect(run.status).toBe("waiting_login");
    expect(run.stage).toBe("xhs_login");
    expect(run.checks.xiaohongshu.status).toBe("waiting");
  });

  it("completes the preflight when providers and MCP are ready", async () => {
    const { service } = createService({
      publicStatus: configuredStatus,
      xhsStatus: loggedInXhsStatus
    });

    const run = await service.startResearch("00000000-0000-4000-8000-000000000001");

    expect(run.status).toBe("completed");
    expect(run.stage).toBe("completed");
    expect(run.checks.llm.status).toBe("passed");
    expect(run.checks.xiaohongshu.status).toBe("passed");
  });
});
