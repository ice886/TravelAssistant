import { Module } from "@nestjs/common";

import { InfrastructureModule } from "../infrastructure/infrastructure.module";
import { McpModule } from "../mcp/mcp.module";
import { PersistenceModule } from "../persistence/persistence.module";
import { WorkflowsModule } from "../workflows/workflows.module";
import { HealthController } from "./health.controller";
import { McpController } from "./mcp.controller";
import { PlannerController } from "./planner.controller";
import { ResearchController } from "./research.controller";
import { TripsController } from "./trips.controller";

@Module({
  imports: [InfrastructureModule, McpModule, PersistenceModule, WorkflowsModule],
  controllers: [TripsController, ResearchController, PlannerController, HealthController, McpController]
})
export class ApiModule {}
