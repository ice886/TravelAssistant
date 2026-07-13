import { Body, Controller, Get, Inject, Param, Post } from "@nestjs/common";

import { CreateTripRequest, Trip } from "../persistence/trip.types";
import { TripRepository } from "../persistence/trip.repository";

@Controller("trips")
export class TripsController {
  constructor(@Inject(TripRepository) private readonly trips: TripRepository) {}
  @Post() createTrip(@Body() body: CreateTripRequest): Promise<Trip> { return this.trips.createTrip(body); }
  @Get() listTrips(): Promise<Trip[]> { return this.trips.listTrips(); }
  @Get(":id") getTrip(@Param("id") id: string): Promise<Trip> { return this.trips.getTrip(id); }
}
