import { Module } from "@nestjs/common";

import { AppConfigModule } from "../config/app-config.module";
import { DatabaseModule } from "../database/database.module";
import { McpModule } from "../mcp/mcp.module";
import { ProvidersModule } from "../providers/providers.module";
import { TripsModule } from "../trips/trips.module";
import { ResearchController } from "./research.controller";
import { ResearchService } from "./research.service";

@Module({
  imports: [AppConfigModule, DatabaseModule, TripsModule, McpModule, ProvidersModule],
  controllers: [ResearchController],
  providers: [ResearchService]
})
export class ResearchModule {}
