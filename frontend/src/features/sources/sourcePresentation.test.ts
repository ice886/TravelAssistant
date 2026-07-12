import { describe, expect, it } from "vitest";

import { ResearchSource } from "../../api/client";
import {
  safeSourceUrl,
  shouldDisplaySourceSummary,
  simplifyChinese
} from "./sourcePresentation";

describe("source presentation", () => {
  it("allows only HTTP(S) source links", () => {
    expect(safeSourceUrl("https://example.com/guide")).toBe("https://example.com/guide");
    expect(safeSourceUrl("http://example.com/guide")).toBe("http://example.com/guide");
    expect(safeSourceUrl("javascript:alert(1)")).toBeNull();
    expect(safeSourceUrl("data:text/html,unsafe")).toBeNull();
    expect(safeSourceUrl("not a url")).toBeNull();
  });

  it("converts research copy to simplified Chinese", () => {
    expect(simplifyChinese("臺北週末旅行與熱門景點")).toBe("台北周末旅行与热门景点");
    expect(simplifyChinese("  行程規劃  ")).toBe("行程规划");
    expect(simplifyChinese(null)).toBe("");
  });

  it("hides summaries only for Tavily web sources", () => {
    expect(shouldDisplaySourceSummary(source("tavily"))).toBe(false);
    expect(shouldDisplaySourceSummary(source("xiaohongshu"))).toBe(true);
    expect(shouldDisplaySourceSummary(source("amap"))).toBe(true);
  });
});

function source(provider: ResearchSource["provider"]): ResearchSource {
  return {
    id: "source-id",
    runId: "run-id",
    provider,
    title: "测试来源",
    url: "https://example.com",
    snippet: "摘要",
    metadata: {},
    createdAt: "2026-07-12T00:00:00.000Z"
  };
}
