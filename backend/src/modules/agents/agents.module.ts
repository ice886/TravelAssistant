import { Module } from "@nestjs/common";

import { AgentCoreModule } from "../agent-core/agent-core.module";
import { InfrastructureModule } from "../infrastructure/infrastructure.module";
import { McpModule } from "../mcp/mcp.module";
import { GetRouteTool } from "./research/tools/get-route.tool";
import { GetWeatherTool } from "./research/tools/get-weather.tool";
import { PoiSearchTool } from "./research/tools/poi-search.tool";
import { WebSearchTool } from "./research/tools/web-search.tool";
import { XhsSearchTool } from "./research/tools/xhs-search.tool";
import { ResearchAgent } from "./research/research.agent";
import { ResearchToolRegistrar } from "./research/research-tool.registrar";
import { PlannerAgent } from "./planner/planner.agent";

@Module({
  imports: [AgentCoreModule, InfrastructureModule, McpModule],
  providers: [ResearchAgent, PlannerAgent, XhsSearchTool, WebSearchTool, PoiSearchTool, GetWeatherTool, GetRouteTool, ResearchToolRegistrar],
  exports: [ResearchAgent, PlannerAgent]
})
export class AgentsModule {}
