import { AgentContext } from "../../agent-core/agent-core.types";
import { PlannerResearchSourceRow, ItineraryContent } from "../../persistence/planner.types";
import { Trip } from "../../persistence/trip.types";

export interface PlannerAgentContext extends AgentContext {
  trip: Trip;
  sources: PlannerResearchSourceRow[];
}

export type PlannerAgentResult = ItineraryContent;

export const ITINERARY_SCHEMA: Record<string, unknown> = {
  type: "object",
  required: ["title", "summary", "currency", "totalEstimatedCost", "days", "tips"],
  properties: {
    title: { type: "string" },
    summary: { type: "string" },
    currency: { type: "string" },
    totalEstimatedCost: { type: "number", minimum: 0 },
    tips: { type: "array", items: { type: "string" } },
    days: { type: "array", items: { type: "object" } }
  }
};
