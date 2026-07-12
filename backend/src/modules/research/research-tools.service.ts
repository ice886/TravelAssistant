import { Inject, Injectable } from "@nestjs/common";

import { McpService } from "../mcp/mcp.service";
import { AmapProviderService } from "../providers/amap.service";
import { ProviderError } from "../providers/provider.types";
import { TavilyProviderService } from "../providers/tavily.service";
import { Trip } from "../trips/trip.types";
import {
  ResearchSourceDraft,
  ResearchToolInput,
  ResearchToolName,
  ResearchToolResult
} from "./research-agent.types";

const MAX_RESULTS_PER_TOOL = 5;
const XHS_SEARCH_MAX_ATTEMPTS = 2;
const XHS_RETRY_DELAY_MS = 500;

@Injectable()
export class ResearchToolsService {
  constructor(
    @Inject(McpService) private readonly mcpService: McpService,
    @Inject(AmapProviderService) private readonly amap: AmapProviderService,
    @Inject(TavilyProviderService) private readonly tavily: TavilyProviderService
  ) {}

  async execute(
    tool: ResearchToolName,
    input: ResearchToolInput,
    trip: Trip
  ): Promise<ResearchToolResult> {
    switch (tool) {
      case "xhs_search":
        return this.searchXhs(input as { query: string });
      case "web_search":
        return this.searchWeb(input as { query: string });
      case "poi_search":
        return this.searchPoi(input as { keyword: string; city?: string }, trip);
      case "get_weather":
        return this.getWeather(input as { city: string });
      case "get_route":
        return this.getRoute(
          input as {
            origin: string;
            destination: string;
            mode: "walking" | "driving" | "transit";
            city?: string;
          },
          trip
        );
    }
  }

  private async searchXhs(input: { query: string }): Promise<ResearchToolResult> {
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= XHS_SEARCH_MAX_ATTEMPTS; attempt += 1) {
      try {
        const result = await this.mcpService.searchXhs(input.query);
        const sources = extractXhsSources(result).slice(0, MAX_RESULTS_PER_TOOL);
        return {
          observation: sources.length > 0 ? `找到 ${sources.length} 条小红书笔记。` : "未找到小红书笔记。",
          sources
        };
      } catch (error) {
        lastError = error;
        if (attempt < XHS_SEARCH_MAX_ATTEMPTS) {
          await delay(XHS_RETRY_DELAY_MS);
        }
      }
    }

    throw lastError instanceof Error ? lastError : new Error("小红书检索失败。");
  }

  private async searchWeb(input: { query: string }): Promise<ResearchToolResult> {
    const result = await this.tavily.search({
      query: input.query,
      maxResults: MAX_RESULTS_PER_TOOL,
      searchDepth: "advanced"
    });
    const sources = result.results.slice(0, MAX_RESULTS_PER_TOOL).map<ResearchSourceDraft>((item) => ({
      provider: "tavily",
      title: item.title,
      url: item.url || null,
      snippet: item.content,
      metadata: {
        tool: "web_search",
        query: input.query,
        score: item.score
      }
    }));

    return {
      observation: sources.length > 0 ? `找到 ${sources.length} 条网页来源。` : "未找到网页来源。",
      sources
    };
  }

  private async searchPoi(
    input: { keyword: string; city?: string },
    trip: Trip
  ): Promise<ResearchToolResult> {
    const city = input.city ?? trip.destination;
    const places = await this.amap.searchPlaces({
      keywords: input.keyword,
      city,
      limit: MAX_RESULTS_PER_TOOL
    });
    const sources = places.slice(0, MAX_RESULTS_PER_TOOL).map<ResearchSourceDraft>((place) => ({
      provider: "amap",
      title: place.name,
      url: null,
      snippet: place.address,
      metadata: {
        tool: "poi_search",
        keyword: input.keyword,
        id: place.id,
        city: place.city,
        location: place.location
      }
    }));

    return {
      observation: sources.length > 0 ? `找到 ${sources.length} 个高德地点。` : "未找到匹配的高德地点。",
      sources
    };
  }

  private async getWeather(input: { city: string }): Promise<ResearchToolResult> {
    const weather = await this.amap.getWeather({ city: input.city });
    const forecastSummary = weather.forecasts
      .slice(0, 4)
      .map((day) =>
        [day.date, day.dayWeather, formatTemperatureRange(day.nightTemperatureCelsius, day.dayTemperatureCelsius)]
          .filter(Boolean)
          .join(" ")
      )
      .join("；");
    const liveSummary = weather.live
      ? [weather.live.weather, formatTemperature(weather.live.temperatureCelsius)]
          .filter(Boolean)
          .join("，")
      : null;
    const snippet = [liveSummary ? `当前：${liveSummary}` : null, forecastSummary ? `预报：${forecastSummary}` : null]
      .filter(Boolean)
      .join("。") || "高德暂未返回天气详情。";
    const source: ResearchSourceDraft = {
      provider: "amap",
      title: `${input.city}天气与预报`,
      url: null,
      snippet,
      metadata: {
        tool: "get_weather",
        city: input.city,
        adcode: weather.adcode,
        live: weather.live,
        forecasts: weather.forecasts
      }
    };

    return {
      observation: `已获取${input.city}天气信息。`,
      sources: [source]
    };
  }

  private async getRoute(
    input: {
      origin: string;
      destination: string;
      mode: "walking" | "driving" | "transit";
      city?: string;
    },
    trip: Trip
  ): Promise<ResearchToolResult> {
    const city = input.city ?? trip.destination;
    const [originResult, destinationResult] = await Promise.all([
      this.amap.geocode({ address: input.origin, city }),
      this.amap.geocode({ address: input.destination, city })
    ]);
    const origin = originResult[0]?.location;
    const destination = destinationResult[0]?.location;

    if (!origin || !destination) {
      throw new ProviderError("amap", "invalid_response", "高德未能解析路线起点或终点坐标。");
    }

    const route = await this.amap.estimateRoute({
      origin,
      destination,
      strategy: input.mode,
      city
    });
    const distance = route.distanceMeters === null ? "距离未知" : formatDistance(route.distanceMeters);
    const duration = route.durationSeconds === null ? "耗时未知" : formatDuration(route.durationSeconds);
    const source: ResearchSourceDraft = {
      provider: "amap",
      title: `${input.origin}至${input.destination}路线`,
      url: null,
      snippet: `${routeModeLabel(input.mode)}，${distance}，预计${duration}。`,
      metadata: {
        tool: "get_route",
        city,
        mode: input.mode,
        origin,
        destination,
        distanceMeters: route.distanceMeters,
        durationSeconds: route.durationSeconds
      }
    };

    return {
      observation: `已获取${input.origin}至${input.destination}的${routeModeLabel(input.mode)}路线。`,
      sources: [source]
    };
  }
}

function extractXhsSources(value: unknown): ResearchSourceDraft[] {
  const candidates = Array.isArray(value)
    ? value
    : isRecord(value)
      ? Object.values(value).find(Array.isArray) ?? [value]
      : [value];

  return candidates
    .filter(isRecord)
    .map((item) => {
      const noteCard = isRecord(item.noteCard) ? item.noteCard : item;
      const user = isRecord(noteCard.user) ? noteCard.user : null;
      const id = stringValue(item.id) ?? stringValue(item.note_id);

      return {
        provider: "xiaohongshu" as const,
        title:
          stringValue(noteCard.displayTitle) ??
          stringValue(item.title) ??
          stringValue(item.name) ??
          "小红书旅行来源",
        url: stringValue(item.url) ?? (id ? `https://www.xiaohongshu.com/explore/${encodeURIComponent(id)}` : null),
        snippet: stringValue(noteCard.desc) ?? stringValue(item.desc) ?? stringValue(item.content),
        metadata: {
          tool: "xhs_search",
          id,
          author: user
            ? stringValue(user.nickname) ?? stringValue(user.nickName)
            : stringValue(item.author)
        }
      };
    });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function formatTemperature(value: number | null): string | null {
  return value === null ? null : `${value}℃`;
}

function formatTemperatureRange(low: number | null, high: number | null): string | null {
  if (low === null && high === null) {
    return null;
  }
  return `${low ?? "?"}~${high ?? "?"}℃`;
}

function formatDistance(meters: number): string {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} 公里` : `${Math.round(meters)} 米`;
}

function formatDuration(seconds: number): string {
  const minutes = Math.max(1, Math.round(seconds / 60));
  return minutes >= 60 ? `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分钟` : `${minutes} 分钟`;
}

function routeModeLabel(mode: "walking" | "driving" | "transit"): string {
  return mode === "walking" ? "步行" : mode === "transit" ? "公共交通" : "驾车";
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
