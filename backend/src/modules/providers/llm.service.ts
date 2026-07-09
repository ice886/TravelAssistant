import { Inject, Injectable } from "@nestjs/common";

import { AppConfigService } from "../config/app-config.service";
import {
  LlmChatRequest,
  LlmChatResponse,
  LlmJsonRequest,
  LlmJsonResponse,
  ProviderError
} from "./provider.types";
import { assertConfigured, FetchFn, isRecord, parseJson, requestJson, stringValue } from "./provider-utils";

@Injectable()
export class LlmProviderService {
  constructor(@Inject(AppConfigService) private readonly config: AppConfigService) {}

  async chat(request: LlmChatRequest, fetchFn: FetchFn = fetch): Promise<LlmChatResponse> {
    const llmConfig = this.config.llm;
    assertConfigured("llm", Boolean(llmConfig.apiKey), "LLM_API_KEY is not configured.");

    const model = request.model ?? llmConfig.model;
    assertConfigured("llm", Boolean(model), "LLM_MODEL is not configured.");

    const payload = await requestJson(
      "llm",
      fetchFn,
      `${llmConfig.baseUrl}/chat/completions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${llmConfig.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model,
          messages: request.messages,
          temperature: request.temperature ?? 0.2,
          max_tokens: request.maxTokens
        })
      },
      llmConfig.timeoutMs
    );

    return normalizeChatResponse(payload);
  }

  async completeJson<TValue = unknown>(
    request: LlmJsonRequest,
    fetchFn: FetchFn = fetch
  ): Promise<LlmJsonResponse<TValue>> {
    const response = await this.chat(
      {
        ...request,
        messages: [
          {
            role: "system",
            content: [
              "Return only valid JSON. Do not include markdown fences, explanations, or extra text.",
              request.schemaName ? `JSON object name: ${request.schemaName}.` : null,
              request.schema ? `JSON schema: ${JSON.stringify(request.schema)}.` : null
            ]
              .filter(Boolean)
              .join(" ")
          },
          ...request.messages
        ]
      },
      fetchFn
    );

    const value = parseJson("llm", response.content) as TValue;

    return {
      ...response,
      value
    };
  }
}

function normalizeChatResponse(payload: unknown): LlmChatResponse {
  if (!isRecord(payload) || !Array.isArray(payload.choices)) {
    throw new ProviderError("llm", "invalid_response", "LLM response did not include choices.");
  }

  const [firstChoice] = payload.choices;
  const content =
    isRecord(firstChoice) && isRecord(firstChoice.message) ? stringValue(firstChoice.message.content) : null;

  if (!content) {
    throw new ProviderError("llm", "invalid_response", "LLM response did not include message content.");
  }

  return {
    content,
    model: stringValue(payload.model),
    raw: payload
  };
}
