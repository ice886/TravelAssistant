import { Inject, Injectable } from "@nestjs/common";

import { BaseTool, ToolResult } from "../../../agent-core/interfaces/tool.interface";
import { AmapProviderService } from "../../../infrastructure/providers/amap.service";
import { ResearchSourceDraft } from "../research.agent.types";

@Injectable()
export class GetWeatherTool implements BaseTool<{ city: string }> {
  readonly name = "get_weather";
  readonly description = "查询目的地实时天气和旅行期间预报。";
  readonly inputSchema = { type: "object", additionalProperties: false, required: ["city"], properties: { city: { type: "string" } } };

  constructor(@Inject(AmapProviderService) private readonly amap: AmapProviderService) {}

  async execute(input: { city: string }): Promise<ToolResult> {
    const weather = await this.amap.getWeather({ city: input.city });
    const forecast = weather.forecasts.slice(0, 4).map((day) => [day.date, day.dayWeather, range(day.nightTemperatureCelsius, day.dayTemperatureCelsius)].filter(Boolean).join(" ")).join("；");
    const live = weather.live ? [weather.live.weather, temperature(weather.live.temperatureCelsius)].filter(Boolean).join("，") : null;
    const source: ResearchSourceDraft = { provider: "amap", title: `${input.city}天气与预报`, url: null, snippet: [live ? `当前：${live}` : null, forecast ? `预报：${forecast}` : null].filter(Boolean).join("。") || "高德暂未返回天气详情。", metadata: { tool: "get_weather", city: input.city, adcode: weather.adcode, live: weather.live, forecasts: weather.forecasts } };
    return { observation: `已获取${input.city}天气信息。`, artifacts: [source] };
  }
}
function temperature(value: number | null): string | null { return value === null ? null : `${value}℃`; }
function range(low: number | null, high: number | null): string | null { return low === null && high === null ? null : `${low ?? "?"}~${high ?? "?"}℃`; }
