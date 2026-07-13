import { Inject, Injectable } from "@nestjs/common";

import { AgentContext, AgentResult } from "./agent-core.types";
import { BaseAgent } from "./base-agent";
import { AgentRunner } from "./agent-runner.service";

export interface OrchestratorStep {
  agent: BaseAgent;
  buildContext: (previousResults: Map<string, AgentResult>) => AgentContext;
  optional?: boolean;
}

@Injectable()
export class AgentOrchestrator {
  constructor(@Inject(AgentRunner) private readonly runner: AgentRunner) {}

  async execute(steps: OrchestratorStep[]): Promise<Map<string, AgentResult>> {
    const results = new Map<string, AgentResult>();
    for (const step of steps) {
      try {
        results.set(step.agent.name, await this.runner.run(step.agent, step.buildContext(results)));
      } catch (error) {
        if (!step.optional) throw error;
      }
    }
    return results;
  }
}
