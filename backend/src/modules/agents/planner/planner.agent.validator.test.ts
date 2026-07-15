import { describe, expect, it } from "vitest";

import { validateItinerary } from "./planner.agent.validator";

describe("validateItinerary", () => {
  it("normalizes safe optional day and activity fields", () => {
    const itinerary = validateItinerary({
      title: "测试行程",
      summary: "测试摘要",
      currency: "CNY",
      totalEstimatedCost: 100,
      days: [{
        day: 1,
        title: "抵达",
        activities: [{
          time: "09:00",
          title: "到达目的地",
          location: "车站",
          description: "办理抵达手续。",
          estimatedCost: 100
        }]
      }],
      tips: []
    });

    expect(itinerary.days[0]).toEqual(expect.objectContaining({ date: null, notes: [] }));
    expect(itinerary.days[0].activities[0]).toEqual(expect.objectContaining({
      transport: "",
      sourceIds: []
    }));
  });

  it("still rejects a day without core fields", () => {
    expect(() => validateItinerary({
      title: "测试行程",
      summary: "测试摘要",
      currency: "CNY",
      totalEstimatedCost: 0,
      days: [{}],
      tips: []
    })).toThrow("Invalid itinerary day at index 0.");
  });
});
