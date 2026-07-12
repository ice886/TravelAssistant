import { describe, expect, it } from "vitest";

import type { ItineraryActivity } from "../../api/client";
import { getActivityIcon } from "./TravelPlan";

function activity(overrides: Partial<ItineraryActivity>): ItineraryActivity {
  return {
    time: "12:00",
    title: "活动",
    location: "地点",
    description: "描述",
    transport: "",
    estimatedCost: 0,
    sourceIds: [],
    ...overrides
  };
}

describe("travel plan activity icons", () => {
  it("prioritizes food content over self-driving transport", () => {
    expect(getActivityIcon(activity({
      title: "午餐品尝当地蒙餐",
      location: "锡林浩特市蒙餐馆",
      description: "推荐烤羊排、蒙古包子、锅茶等特色美食",
      transport: "自驾"
    }))).toBe("food");
  });

  it("uses the camera icon for photography activities", () => {
    expect(getActivityIcon(activity({ title: "古城摄影拍照" }))).toBe("camera");
  });

  it("uses the car icon when the activity itself has no stronger content category", () => {
    expect(getActivityIcon(activity({ title: "前往下一站", transport: "自驾" }))).toBe("car");
  });

  it("keeps route activities as cars when descriptions mention photography", () => {
    expect(getActivityIcon(activity({
      title: "出发前往99号公路",
      location: "99号公路起点",
      description: "沿途草原风光壮美，可随时停车拍摄。",
      transport: "自驾"
    }))).toBe("car");

    expect(getActivityIcon(activity({
      title: "返回市区还车并结束行程",
      location: "锡林浩特机场/火车站",
      description: "按时还车，结束草原摄影之旅。",
      transport: "自驾"
    }))).toBe("car");
  });
});
