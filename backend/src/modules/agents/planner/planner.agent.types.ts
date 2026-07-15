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
  additionalProperties: false,
  required: ["title", "summary", "currency", "totalEstimatedCost", "days", "tips"],
  properties: {
    title: { type: "string", minLength: 1 },
    summary: { type: "string", minLength: 1 },
    currency: { type: "string", minLength: 1 },
    totalEstimatedCost: { type: "number", minimum: 0 },
    tips: { type: "array", items: { type: "string" } },
    days: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["day", "date", "title", "activities", "notes"],
        properties: {
          day: { type: "integer", minimum: 1 },
          date: { type: ["string", "null"] },
          title: { type: "string", minLength: 1 },
          notes: { type: "array", items: { type: "string" } },
          activities: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: [
                "time",
                "title",
                "location",
                "description",
                "transport",
                "estimatedCost",
                "sourceIds"
              ],
              properties: {
                time: { type: "string", minLength: 1 },
                title: { type: "string", minLength: 1 },
                location: { type: "string", minLength: 1 },
                description: { type: "string", minLength: 1 },
                transport: { type: "string" },
                estimatedCost: { type: "number", minimum: 0 },
                sourceIds: { type: "array", items: { type: "string" } }
              }
            }
          }
        }
      }
    }
  }
};
