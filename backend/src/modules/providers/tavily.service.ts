import { Inject, Injectable } from "@nestjs/common";

import { AppConfigService } from "../config/app-config.service";
import { TavilySearchRequest, TavilySearchResponse } from "./provider.types";
import { assertConfigured, FetchFn, isRecord, numberValue, requestJson, stringValue } from "./provider-utils";

@Injectable()
export class TavilyProviderService {
  constructor(@Inject(AppConfigService) private readonly config: AppConfigService) {}

  async search(request: TavilySearchRequest, fetchFn: FetchFn = fetch): Promise<TavilySearchResponse> {
    const tavilyConfig = this.config.tavily;
    assertConfigured("tavily", Boolean(tavilyConfig.apiKey), "TAVILY_API_KEY is not configured.");

    const payload = await requestJson(
      "tavily",
      fetchFn,
      `${tavilyConfig.baseUrl}/search`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          api_key: tavilyConfig.apiKey,
          query: request.query,
          search_depth: request.searchDepth ?? "basic",
          include_answer: request.includeAnswer ?? true,
          max_results: request.maxResults ?? 5
        })
      },
      tavilyConfig.timeoutMs
    );

    if (!isRecord(payload)) {
      return {
        query: request.query,
        answer: null,
        results: [],
        raw: payload
      };
    }

    return {
      query: stringValue(payload.query) ?? request.query,
      answer: stringValue(payload.answer),
      results: Array.isArray(payload.results) ? payload.results.filter(isRecord).map(normalizeResult) : [],
      raw: payload
    };
  }
}

function normalizeResult(item: Record<string, unknown>) {
  return {
    title: stringValue(item.title) ?? "Untitled",
    url: stringValue(item.url) ?? "",
    content: stringValue(item.content) ?? "",
    score: numberValue(item.score),
    raw: item
  };
}
