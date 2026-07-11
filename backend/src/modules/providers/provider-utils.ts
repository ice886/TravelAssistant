import { ProviderError, ProviderName } from "./provider.types";

export type FetchFn = typeof fetch;

export function assertConfigured(
  provider: ProviderName,
  configured: boolean,
  message: string
): asserts configured {
  if (!configured) {
    throw new ProviderError(provider, "not_configured", message);
  }
}

export async function requestJson(
  provider: ProviderName,
  fetchFn: FetchFn,
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchFn(url, {
      ...init,
      signal: controller.signal
    });
    const body = await response.text();
    const payload = body ? parseJson(provider, body) : null;

    if (!response.ok) {
      throw new ProviderError(
        provider,
        "request_failed",
        `${provider} request failed: ${response.status} ${response.statusText}`,
        response.status
      );
    }

    return payload;
  } catch (error) {
    if (error instanceof ProviderError) {
      throw error;
    }

    throw new ProviderError(
      provider,
      "request_failed",
      normalizeErrorMessage(provider, error, timeoutMs)
    );
  } finally {
    clearTimeout(timeout);
  }
}

export function parseJson(provider: ProviderName, body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    throw new ProviderError(provider, "invalid_response", `${provider} response is not valid JSON.`);
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

export function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function normalizeErrorMessage(
  provider: ProviderName,
  error: unknown,
  timeoutMs: number
): string {
  if (error instanceof Error && error.name === "AbortError") {
    return `${provider} request timed out after ${timeoutMs}ms.`;
  }

  return error instanceof Error ? error.message : `${provider} request failed.`;
}
