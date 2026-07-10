import { Controller, Get, Inject, Param, Post } from "@nestjs/common";

import { ResearchService } from "./research.service";

@Controller("trips/:tripId")
export class ResearchController {
  constructor(@Inject(ResearchService) private readonly researchService: ResearchService) {}

  @Post("research")
  startResearch(@Param("tripId") tripId: string) {
    return this.researchService.startResearch(tripId);
  }

  @Get("research-runs/latest")
  getLatestRun(@Param("tripId") tripId: string) {
    return this.researchService.getLatestRun(tripId);
  }

  @Get("research-sources")
  getSources(@Param("tripId") tripId: string) {
    return this.researchService.getSources(tripId);
  }
}
