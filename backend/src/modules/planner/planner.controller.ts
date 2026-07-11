import { Body, Controller, Get, Inject, Param, Post } from "@nestjs/common";

import { PlannerService } from "./planner.service";
import { ItineraryVersion } from "./planner.types";

@Controller("trips/:tripId/itineraries")
export class PlannerController {
  constructor(@Inject(PlannerService) private readonly planner: PlannerService) {}

  @Post("generate")
  generate(@Param("tripId") tripId: string): Promise<ItineraryVersion> {
    return this.planner.generate(tripId);
  }

  @Get("latest")
  getLatest(@Param("tripId") tripId: string): Promise<ItineraryVersion> {
    return this.planner.getLatest(tripId);
  }

  @Post()
  save(
    @Param("tripId") tripId: string,
    @Body() content: unknown
  ): Promise<ItineraryVersion> {
    return this.planner.save(tripId, content);
  }
}
