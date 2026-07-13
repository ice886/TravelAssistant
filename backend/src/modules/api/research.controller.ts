import { Controller, Get, Inject, Param, Post } from "@nestjs/common";

import { AgentRun, ResearchSource } from "../persistence/research.types";
import { ResearchWorkflow } from "../workflows/research.workflow";

@Controller("trips/:tripId")
export class ResearchController {
  constructor(@Inject(ResearchWorkflow) private readonly workflow: ResearchWorkflow) {}
  @Post("research") startResearch(@Param("tripId") tripId: string): Promise<AgentRun> { return this.workflow.startResearch(tripId); }
  @Get("research-runs/latest") getLatestRun(@Param("tripId") tripId: string): Promise<AgentRun> { return this.workflow.getLatestRun(tripId); }
  @Get("research-sources") getSources(@Param("tripId") tripId: string): Promise<ResearchSource[]> { return this.workflow.getSources(tripId); }
}
