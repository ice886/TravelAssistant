import { Module } from "@nestjs/common";

import { AgentCoreModule } from "./modules/agent-core/agent-core.module";
import { AgentsModule } from "./modules/agents/agents.module";
import { ApiModule } from "./modules/api/api.module";
import { InfrastructureModule } from "./modules/infrastructure/infrastructure.module";
import { McpModule } from "./modules/mcp/mcp.module";
import { PersistenceModule } from "./modules/persistence/persistence.module";
import { WorkflowsModule } from "./modules/workflows/workflows.module";

@Module({
  imports: [InfrastructureModule, McpModule, AgentCoreModule, AgentsModule, PersistenceModule, WorkflowsModule, ApiModule]
})
export class AppModule {}
