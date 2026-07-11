export const ITINERARY_SCHEMA = {
  type: "object",
  required: ["title", "summary", "currency", "totalEstimatedCost", "days", "tips"],
  properties: {
    title: { type: "string" },
    summary: { type: "string" },
    currency: { type: "string" },
    totalEstimatedCost: { type: "number", minimum: 0 },
    tips: {
      type: "array",
      items: { type: "string" }
    },
    days: {
      type: "array",
      items: {
        type: "object",
        required: ["day", "date", "title", "activities", "notes"],
        properties: {
          day: { type: "integer" },
          date: { type: ["string", "null"] },
          title: { type: "string" },
          notes: {
            type: "array",
            items: { type: "string" }
          },
          activities: {
            type: "array",
            items: {
              type: "object",
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
                time: { type: "string" },
                title: { type: "string" },
                location: { type: "string" },
                description: { type: "string" },
                transport: { type: "string" },
                estimatedCost: { type: "number", minimum: 0 },
                sourceIds: {
                  type: "array",
                  items: { type: "string" }
                }
              }
            }
          }
        }
      }
    }
  }
} satisfies Record<string, unknown>;
