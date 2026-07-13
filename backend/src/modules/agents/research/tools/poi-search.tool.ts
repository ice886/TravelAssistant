import { Inject, Injectable } from "@nestjs/common";

import { BaseTool, ToolResult } from "../../../agent-core/interfaces/tool.interface";
import { AmapProviderService } from "../../../infrastructure/providers/amap.service";
import { Trip } from "../../../persistence/trip.types";
import { ResearchSourceDraft } from "../research.agent.types";

@Injectable()
export class PoiSearchTool implements BaseTool<{ keyword: string; city?: string }, { trip: Trip }> {
  readonly name = "poi_search";
  readonly description = "搜索目的地地点和景点。";
  readonly inputSchema = { type: "object", additionalProperties: false, required: ["keyword"], properties: { keyword: { type: "string" }, city: { type: "string" } } };

  constructor(@Inject(AmapProviderService) private readonly amap: AmapProviderService) {}

  async execute(input: { keyword: string; city?: string }, context: { trip: Trip }): Promise<ToolResult> {
    const city = input.city ?? context.trip.destination;
    const places = await this.amap.searchPlaces({ keywords: input.keyword, city, limit: 5 });
    const sources = places.slice(0, 5).map<ResearchSourceDraft>((place) => ({
      provider: "amap", title: place.name, url: null, snippet: place.address,
      metadata: { tool: "poi_search", keyword: input.keyword, id: place.id, city: place.city, location: place.location }
    }));
    return { observation: sources.length > 0 ? `找到 ${sources.length} 个高德地点。` : "未找到匹配的高德地点。", artifacts: sources };
  }
}
