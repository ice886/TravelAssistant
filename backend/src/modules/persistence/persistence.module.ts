import { Module } from "@nestjs/common";

import { InfrastructureModule } from "../infrastructure/infrastructure.module";
import { AgentRunRepository } from "./agent-run.repository";
import { ItineraryRepository } from "./itinerary.repository";
import { ResearchSourceRepository } from "./research-source.repository";
import { TripRepository } from "./trip.repository";

@Module({
  imports: [InfrastructureModule],
  providers: [TripRepository, AgentRunRepository, ResearchSourceRepository, ItineraryRepository],
  exports: [TripRepository, AgentRunRepository, ResearchSourceRepository, ItineraryRepository]
})
export class PersistenceModule {}
