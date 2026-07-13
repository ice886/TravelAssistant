import { Inject, Injectable } from "@nestjs/common";

import { BaseTool, ToolResult } from "../../../agent-core/interfaces/tool.interface";
import { AmapProviderService } from "../../../infrastructure/providers/amap.service";
import { ProviderError } from "../../../infrastructure/providers/provider.types";
import { Trip } from "../../../persistence/trip.types";
import { ResearchSourceDraft } from "../research.agent.types";

type RouteInput = { origin: string; destination: string; mode: "walking" | "driving" | "transit"; city?: string };

@Injectable()
export class GetRouteTool implements BaseTool<RouteInput, { trip: Trip }> {
  readonly name = "get_route";
  readonly description = "查询两个地点之间的步行、驾车或公共交通路线。";
  readonly inputSchema = { type: "object", additionalProperties: false, required: ["origin", "destination", "mode"], properties: { origin: { type: "string" }, destination: { type: "string" }, mode: { enum: ["walking", "driving", "transit"] }, city: { type: "string" } } };

  constructor(@Inject(AmapProviderService) private readonly amap: AmapProviderService) {}

  async execute(input: RouteInput, context: { trip: Trip }): Promise<ToolResult> {
    const city = input.city ?? context.trip.destination;
    const [from, to] = await Promise.all([this.amap.geocode({ address: input.origin, city }), this.amap.geocode({ address: input.destination, city })]);
    const origin = from[0]?.location;
    const destination = to[0]?.location;
    if (!origin || !destination) throw new ProviderError("amap", "invalid_response", "高德未能解析路线起点或终点坐标。");
    const route = await this.amap.estimateRoute({ origin, destination, strategy: input.mode, city });
    const source: ResearchSourceDraft = { provider: "amap", title: `${input.origin}至${input.destination}路线`, url: null, snippet: `${label(input.mode)}，${distance(route.distanceMeters)}，预计${duration(route.durationSeconds)}。`, metadata: { tool: "get_route", city, mode: input.mode, origin, destination, distanceMeters: route.distanceMeters, durationSeconds: route.durationSeconds } };
    return { observation: `已获取${input.origin}至${input.destination}的${label(input.mode)}路线。`, artifacts: [source] };
  }
}
function label(mode: RouteInput["mode"]): string { return mode === "walking" ? "步行" : mode === "transit" ? "公共交通" : "驾车"; }
function distance(meters: number | null): string { return meters === null ? "距离未知" : meters >= 1000 ? `${(meters / 1000).toFixed(1)} 公里` : `${Math.round(meters)} 米`; }
function duration(seconds: number | null): string { if (seconds === null) return "耗时未知"; const minutes = Math.max(1, Math.round(seconds / 60)); return minutes >= 60 ? `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分钟` : `${minutes} 分钟`; }
