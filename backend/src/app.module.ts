import { Module } from "@nestjs/common";

import { AppConfigModule } from "./modules/config/app-config.module";
import { HealthModule } from "./modules/health/health.module";
import { McpModule } from "./modules/mcp/mcp.module";
import { PlannerModule } from "./modules/planner/planner.module";
import { ProvidersModule } from "./modules/providers/providers.module";
import { ResearchModule } from "./modules/research/research.module";
import { TripsModule } from "./modules/trips/trips.module";

@Module({
  imports: [AppConfigModule, HealthModule, TripsModule, McpModule, ProvidersModule, ResearchModule, PlannerModule]
})
export class AppModule {}
