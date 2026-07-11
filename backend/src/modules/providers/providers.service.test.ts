import { describe, expect, it, vi } from "vitest";

import { AppConfigService } from "../config/app-config.service";
import { AmapProviderService } from "./amap.service";
import { LlmProviderService } from "./llm.service";
import { requestJson } from "./provider-utils";
import { TavilyProviderService } from "./tavily.service";

function createConfig(overrides: Partial<AppConfigService> = {}): AppConfigService {
  return overrides as AppConfigService;
}

function jsonResponse(payload: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      "Content-Type": "application/json"
    },
    ...init
  });
}

describe("AmapProviderService", () => {
  it("fails before network calls when AMAP_API_KEY is missing", async () => {
    const service = new AmapProviderService(
      createConfig({
        amap: {
          apiKey: null,
          baseUrl: "https://restapi.amap.com/v3",
          timeoutMs: 1000
        }
      })
    );
    const fetchFn = vi.fn();

    await expect(service.searchPlaces({ keywords: "coffee" }, fetchFn)).rejects.toMatchObject({
      provider: "amap",
      code: "not_configured"
    });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("normalizes place search responses", async () => {
    const service = new AmapProviderService(
      createConfig({
        amap: {
          apiKey: "amap-key",
          baseUrl: "https://restapi.amap.com/v3",
          timeoutMs: 1000
        }
      })
    );
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse({
        status: "1",
        pois: [
          {
            id: "p1",
            name: "西湖",
            address: "杭州",
            cityname: "杭州市",
            location: "120.143222,30.236064"
          }
        ]
      })
    );

    const places = await service.searchPlaces({ keywords: "西湖", city: "杭州", limit: 3 }, fetchFn);
    const [url] = fetchFn.mock.calls[0] as [string];

    expect(url).toContain("/place/text");
    expect(url).toContain("key=amap-key");
    expect(places[0]).toMatchObject({
      id: "p1",
      name: "西湖",
      city: "杭州市",
      location: {
        longitude: 120.143222,
        latitude: 30.236064
      }
    });
  });
});

describe("TavilyProviderService", () => {
  it("normalizes search responses", async () => {
    const service = new TavilyProviderService(
      createConfig({
        tavily: {
          apiKey: "tavily-key",
          baseUrl: "https://api.tavily.com",
          timeoutMs: 1000
        }
      })
    );
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse({
        query: "杭州美食",
        answer: "Some answer",
        results: [
          {
            title: "Guide",
            url: "https://example.com",
            content: "Useful content",
            score: 0.8
          }
        ]
      })
    );

    const result = await service.search({ query: "杭州美食", maxResults: 2 }, fetchFn);
    const [, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;

    expect(body.api_key).toBe("tavily-key");
    expect(result.results[0]).toMatchObject({
      title: "Guide",
      url: "https://example.com",
      score: 0.8
    });
  });
});

describe("LlmProviderService", () => {
  it("normalizes OpenAI-compatible chat responses", async () => {
    const service = new LlmProviderService(
      createConfig({
        llm: {
          provider: "openai-compatible",
          baseUrl: "https://api.openai.com/v1",
          apiKey: "llm-key",
          model: "gpt-test",
          timeoutMs: 1000
        }
      })
    );
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse({
        model: "gpt-test",
        choices: [
          {
            message: {
              content: "hello"
            }
          }
        ]
      })
    );

    const result = await service.chat({ messages: [{ role: "user", content: "Hi" }] }, fetchFn);
    const [, init] = fetchFn.mock.calls[0] as [string, RequestInit];

    expect(init.headers).toMatchObject({
      Authorization: "Bearer llm-key"
    });
    expect(result).toMatchObject({
      content: "hello",
      model: "gpt-test"
    });
  });

  it("parses JSON completions and rejects non-JSON content", async () => {
    const service = new LlmProviderService(
      createConfig({
        llm: {
          provider: "openai-compatible",
          baseUrl: "https://api.openai.com/v1",
          apiKey: "llm-key",
          model: "gpt-test",
          timeoutMs: 1000
        }
      })
    );
    const fetchFn = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        model: "gpt-test",
        choices: [
          {
            message: {
              content: "{\"ok\":true}"
            }
          }
        ]
      })
    );

    await expect(
      service.completeJson<{ ok: boolean }>({ messages: [{ role: "user", content: "JSON please" }] }, fetchFn)
    ).resolves.toMatchObject({
      value: {
        ok: true
      }
    });

    fetchFn.mockResolvedValueOnce(
      jsonResponse({
        model: "gpt-test",
        choices: [
          {
            message: {
              content: "not json"
            }
          }
        ]
      })
    );

    await expect(
      service.completeJson({ messages: [{ role: "user", content: "JSON please" }] }, fetchFn)
    ).rejects.toMatchObject({
      provider: "llm",
      code: "invalid_response"
    });
  });
});

describe("requestJson", () => {
  it("includes the configured timeout in abort errors", async () => {
    const abortError = new Error("aborted");
    abortError.name = "AbortError";
    const fetchFn = vi.fn().mockRejectedValue(abortError);

    await expect(
      requestJson("llm", fetchFn, "https://example.com", {}, 300000)
    ).rejects.toMatchObject({
      provider: "llm",
      code: "request_failed",
      message: "llm request timed out after 300000ms."
    });
  });
});
