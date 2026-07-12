import { ResearchSource } from "../../api/client";
import { sify } from "chinese-conv";

export function sourceProviderLabel(source: ResearchSource): string {
  if (source.provider === "xiaohongshu") return "小红书";
  if (source.provider === "tavily") return "网页";
  return source.metadata.tool === "get_weather"
    ? "高德天气"
    : source.metadata.tool === "get_route"
      ? "高德路线"
      : "高德地图";
}

export function safeSourceUrl(value: string | null): string | null {
  if (!value || value.length > 2048) return null;

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function simplifyChinese(value: string | null | undefined): string {
  return sify(value?.trim() || "");
}

export function shouldDisplaySourceSummary(source: ResearchSource): boolean {
  return source.provider !== "tavily";
}
