import { Inject, Injectable, OnModuleInit } from "@nestjs/common";

import { ToolRegistry } from "../../agent-core/tool-registry.service";
import { GetRouteTool } from "./tools/get-route.tool";
import { GetWeatherTool } from "./tools/get-weather.tool";
import { PoiSearchTool } from "./tools/poi-search.tool";
import { WebSearchTool } from "./tools/web-search.tool";
import { XhsSearchTool } from "./tools/xhs-search.tool";

@Injectable()
export class ResearchToolRegistrar implements OnModuleInit {
  constructor(
    @Inject(ToolRegistry) private readonly registry: ToolRegistry,
    @Inject(XhsSearchTool) private readonly xhsSearch: XhsSearchTool,
    @Inject(WebSearchTool) private readonly webSearch: WebSearchTool,
    @Inject(PoiSearchTool) private readonly poiSearch: PoiSearchTool,
    @Inject(GetWeatherTool) private readonly getWeather: GetWeatherTool,
    @Inject(GetRouteTool) private readonly getRoute: GetRouteTool
  ) {}

  onModuleInit(): void {
    [this.xhsSearch, this.webSearch, this.poiSearch, this.getWeather, this.getRoute].forEach((tool) => this.registry.register(tool));
  }
}
