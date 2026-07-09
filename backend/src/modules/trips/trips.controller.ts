import { Body, Controller, Get, Inject, Param, Post } from "@nestjs/common";

import { CreateTripRequest } from "./trip.types";
import { TripsService } from "./trips.service";

@Controller("trips")
export class TripsController {
  constructor(@Inject(TripsService) private readonly tripsService: TripsService) {}

  @Post()
  createTrip(@Body() body: CreateTripRequest) {
    return this.tripsService.createTrip(body);
  }

  @Get()
  listTrips() {
    return this.tripsService.listTrips();
  }

  @Get(":id")
  getTrip(@Param("id") id: string) {
    return this.tripsService.getTrip(id);
  }
}
