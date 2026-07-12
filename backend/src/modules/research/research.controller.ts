import { Controller, Get, Inject, Param, Post } from "@nestjs/common";

import { ResearchService } from "./research.service";
import { AgentRun, ResearchSource } from "./research.types";

@Controller("trips/:tripId")
export class ResearchController {
  constructor(@Inject(ResearchService) private readonly researchService: ResearchService) {}

  @Post("research")
  startResearch(@Param("tripId") tripId: string): Promise<AgentRun> {
    return this.researchService.startResearch(tripId);
  }

  @Get("research-runs/latest")
  getLatestRun(@Param("tripId") tripId: string): Promise<AgentRun> {
    return this.researchService.getLatestRun(tripId);
  }

  @Get("research-sources")
  getSources(@Param("tripId") tripId: string): Promise<ResearchSource[]> {
    return this.researchService.getSources(tripId);
  }
}
