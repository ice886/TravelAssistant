import { describe, expect, it } from "vitest";

import { researchToolLabel, researchToolStatusLabel } from "./researchPresentation";

describe("research presentation", () => {
  it("uses concise Chinese labels for every Agent tool", () => {
    expect(researchToolLabel("xhs_search")).toBe("小红书搜索");
    expect(researchToolLabel("get_weather")).toBe("天气查询");
    expect(researchToolLabel("get_route")).toBe("路线查询");
  });

  it("presents failed tool calls as a degradation", () => {
    expect(researchToolStatusLabel("failed")).toBe("调用失败");
    expect(researchToolStatusLabel("skipped")).toBe("已跳过");
  });
});
