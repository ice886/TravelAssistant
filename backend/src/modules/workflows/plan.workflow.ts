import { BadRequestException, Inject, Injectable } from "@nestjs/common";

import { AgentOrchestrator } from "../agent-core/orchestrator.service";
import { AgentRunner } from "../agent-core/agent-runner.service";
import { PlannerAgent } from "../agents/planner/planner.agent";
import { validateItinerary } from "../agents/planner/planner.agent.validator";
import { ItineraryRepository } from "../persistence/itinerary.repository";
import { ItineraryVersion } from "../persistence/planner.types";
import { ResearchSourceRepository } from "../persistence/research-source.repository";
import { TripRepository } from "../persistence/trip.repository";

@Injectable()
export class PlanWorkflow {
  constructor(
    @Inject(AgentRunner) private readonly runner: AgentRunner,
    @Inject(AgentOrchestrator) private readonly orchestrator: AgentOrchestrator,
    @Inject(PlannerAgent) private readonly plannerAgent: PlannerAgent,
    @Inject(ResearchSourceRepository) private readonly sources: ResearchSourceRepository,
    @Inject(ItineraryRepository) private readonly itineraries: ItineraryRepository,
    @Inject(TripRepository) private readonly trips: TripRepository
  ) {}

  async generate(tripId: string): Promise<ItineraryVersion> {
    const trip = await this.trips.getTrip(tripId);
    const sources = await this.sources.getLatestResearchSources(tripId);
    if (sources.length === 0) throw new BadRequestException("Generate research sources before creating an itinerary.");
    const result = await this.runner.run(this.plannerAgent, { mode: "generate", availableTools: [], maxRounds: 1, degradationReasons: [], trip, sources });
    const content = result.artifacts[0];
    return this.itineraries.insertVersion({ tripId, researchRunId: sources[0].run_id, source: "generated", content: content as never });
  }

  async getLatest(tripId: string): Promise<ItineraryVersion> {
    await this.trips.getTrip(tripId);
    return this.itineraries.getLatest(tripId);
  }

  async save(tripId: string, input: unknown): Promise<ItineraryVersion> {
    await this.trips.getTrip(tripId);
    return this.itineraries.insertVersion({ tripId, researchRunId: null, source: "edited", content: validateItinerary(input) });
  }

  async researchAndPlan(): Promise<never> {
    void this.orchestrator;
    throw new Error("Research and plan orchestration is reserved for a future workflow entry point.");
  }
}
