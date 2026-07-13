import { Body, Controller, Get, Inject, Param, Post } from "@nestjs/common";

import { ItineraryVersion } from "../persistence/planner.types";
import { PlanWorkflow } from "../workflows/plan.workflow";

@Controller("trips/:tripId/itineraries")
export class PlannerController {
  constructor(@Inject(PlanWorkflow) private readonly workflow: PlanWorkflow) {}
  @Post("generate") generate(@Param("tripId") tripId: string): Promise<ItineraryVersion> { return this.workflow.generate(tripId); }
  @Get("latest") getLatest(@Param("tripId") tripId: string): Promise<ItineraryVersion> { return this.workflow.getLatest(tripId); }
  @Post() save(@Param("tripId") tripId: string, @Body() content: unknown): Promise<ItineraryVersion> { return this.workflow.save(tripId, content); }
}
