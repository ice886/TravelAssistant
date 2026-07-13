import { Module } from "@nestjs/common";

import { AgentCoreModule } from "../agent-core/agent-core.module";
import { AgentsModule } from "../agents/agents.module";
import { InfrastructureModule } from "../infrastructure/infrastructure.module";
import { McpModule } from "../mcp/mcp.module";
import { PersistenceModule } from "../persistence/persistence.module";
import { PlanWorkflow } from "./plan.workflow";
import { ResearchWorkflow } from "./research.workflow";

@Module({
  imports: [InfrastructureModule, McpModule, AgentCoreModule, AgentsModule, PersistenceModule],
  providers: [ResearchWorkflow, PlanWorkflow],
  exports: [ResearchWorkflow, PlanWorkflow]
})
export class WorkflowsModule {}
