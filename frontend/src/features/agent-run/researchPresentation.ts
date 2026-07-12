import { ResearchToolName } from "../../api/client";

export function researchToolLabel(tool: ResearchToolName): string {
  const labels: Record<ResearchToolName, string> = {
    xhs_search: "小红书搜索",
    web_search: "网页搜索",
    poi_search: "地点搜索",
    get_weather: "天气查询",
    get_route: "路线查询"
  };
  return labels[tool];
}

export function researchToolStatusLabel(status: "completed" | "failed" | "skipped"): string {
  const labels = {
    completed: "已完成",
    failed: "调用失败",
    skipped: "已跳过"
  } as const;
  return labels[status];
}
