import { Inject, Injectable } from "@nestjs/common";

import { BaseTool, ToolResult } from "../../../agent-core/interfaces/tool.interface";
import { TavilyProviderService } from "../../../infrastructure/providers/tavily.service";
import { ResearchSourceDraft } from "../research.agent.types";

@Injectable()
export class WebSearchTool implements BaseTool<{ query: string }> {
  readonly name = "web_search";
  readonly description = "搜索网页来源，获取地点事实、攻略和实用信息。";
  readonly inputSchema = { type: "object", additionalProperties: false, required: ["query"], properties: { query: { type: "string" } } };

  constructor(@Inject(TavilyProviderService) private readonly tavily: TavilyProviderService) {}

  async execute(input: { query: string }): Promise<ToolResult> {
    const result = await this.tavily.search({ query: input.query, maxResults: 5, searchDepth: "advanced" });
    const sources = result.results.slice(0, 5).map<ResearchSourceDraft>((item) => ({
      provider: "tavily", title: item.title, url: item.url || null, snippet: item.content,
      metadata: { tool: "web_search", query: input.query, score: item.score }
    }));
    return { observation: sources.length > 0 ? `找到 ${sources.length} 条网页来源。` : "未找到网页来源。", artifacts: sources };
  }
}
