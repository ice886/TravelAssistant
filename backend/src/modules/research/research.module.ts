import { Module } from "@nestjs/common";

import { AppConfigModule } from "../config/app-config.module";
import { DatabaseModule } from "../database/database.module";
import { McpModule } from "../mcp/mcp.module";
import { ProvidersModule } from "../providers/providers.module";
import { TripsModule } from "../trips/trips.module";
import { ResearchAgentService } from "./research-agent.service";
import { ResearchCacheService } from "./research-cache.service";
import { ResearchController } from "./research.controller";
import { ResearchService } from "./research.service";
import { ResearchToolsService } from "./research-tools.service";

@Module({
  imports: [AppConfigModule, DatabaseModule, TripsModule, McpModule, ProvidersModule],
  controllers: [ResearchController],
  providers: [ResearchService, ResearchAgentService, ResearchCacheService, ResearchToolsService]
})
export class ResearchModule {}
