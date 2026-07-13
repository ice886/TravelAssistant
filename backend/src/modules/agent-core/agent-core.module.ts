import { Global, Module } from "@nestjs/common";

import { ProvidersModule } from "../infrastructure/providers/providers.module";
import { AgentOrchestrator } from "./orchestrator.service";
import { AgentRunner } from "./agent-runner.service";
import { ToolRegistry } from "./tool-registry.service";

@Global()
@Module({
  imports: [ProvidersModule],
  providers: [ToolRegistry, AgentRunner, AgentOrchestrator],
  exports: [ToolRegistry, AgentRunner, AgentOrchestrator]
})
export class AgentCoreModule {}
