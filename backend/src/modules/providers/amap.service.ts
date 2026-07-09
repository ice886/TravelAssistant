import { Inject, Injectable } from "@nestjs/common";

import { AppConfigService } from "../config/app-config.service";
import {
  AmapPlace,
  AmapRouteEstimate,
  GeocodeRequest,
  GeoPoint,
  ProviderError,
  RouteEstimateRequest,
  SearchPlacesRequest
} from "./provider.types";
import { assertConfigured, FetchFn, isRecord, numberValue, requestJson, stringValue } from "./provider-utils";

@Injectable()
export class AmapProviderService {
  constructor(@Inject(AppConfigService) private readonly config: AppConfigService) {}

  async searchPlaces(request: SearchPlacesRequest, fetchFn: FetchFn = fetch): Promise<AmapPlace[]> {
    const amapConfig = this.config.amap;
    assertConfigured("amap", Boolean(amapConfig.apiKey), "AMAP_API_KEY is not configured.");

    const payload = await requestJson(
      "amap",
      fetchFn,
      this.buildUrl("/place/text", {
        key: amapConfig.apiKey,
        keywords: request.keywords,
        city: request.city,
        offset: String(request.limit ?? 10)
      }),
      { method: "GET" },
      amapConfig.timeoutMs
    );

    assertAmapSuccess(payload);

    if (!isRecord(payload) || !Array.isArray(payload.pois)) {
      return [];
    }

    return payload.pois.filter(isRecord).map(normalizePlace);
  }

  async geocode(request: GeocodeRequest, fetchFn: FetchFn = fetch): Promise<AmapPlace[]> {
    const amapConfig = this.config.amap;
    assertConfigured("amap", Boolean(amapConfig.apiKey), "AMAP_API_KEY is not configured.");

    const payload = await requestJson(
      "amap",
      fetchFn,
      this.buildUrl("/geocode/geo", {
        key: amapConfig.apiKey,
        address: request.address,
        city: request.city
      }),
      { method: "GET" },
      amapConfig.timeoutMs
    );

    assertAmapSuccess(payload);

    if (!isRecord(payload) || !Array.isArray(payload.geocodes)) {
      return [];
    }

    return payload.geocodes.filter(isRecord).map((item) => ({
      id: null,
      name: stringValue(item.formatted_address) ?? request.address,
      address: stringValue(item.formatted_address),
      city: stringValue(item.city),
      location: parseLocation(item.location),
      raw: item
    }));
  }

  async estimateRoute(
    request: RouteEstimateRequest,
    fetchFn: FetchFn = fetch
  ): Promise<AmapRouteEstimate> {
    const amapConfig = this.config.amap;
    assertConfigured("amap", Boolean(amapConfig.apiKey), "AMAP_API_KEY is not configured.");

    const strategy = request.strategy ?? "driving";
    const payload = await requestJson(
      "amap",
      fetchFn,
      this.buildUrl(strategy === "walking" ? "/direction/walking" : "/direction/driving", {
        key: amapConfig.apiKey,
        origin: formatPoint(request.origin),
        destination: formatPoint(request.destination)
      }),
      { method: "GET" },
      amapConfig.timeoutMs
    );

    assertAmapSuccess(payload);

    return {
      origin: request.origin,
      destination: request.destination,
      distanceMeters: readRouteNumber(payload, "distance"),
      durationSeconds: readRouteNumber(payload, "duration"),
      strategy,
      raw: payload
    };
  }

  private buildUrl(path: string, params: Record<string, string | null | undefined>): string {
    const url = new URL(`${this.config.amap.baseUrl}${path}`);

    for (const [key, value] of Object.entries(params)) {
      if (value) {
        url.searchParams.set(key, value);
      }
    }

    return url.toString();
  }
}

function assertAmapSuccess(payload: unknown): void {
  if (!isRecord(payload) || payload.status !== "1") {
    const message = isRecord(payload)
      ? stringValue(payload.info) ?? "Amap returned an unsuccessful response."
      : "Amap response is not an object.";

    throw new ProviderError("amap", "request_failed", message);
  }
}

function normalizePlace(item: Record<string, unknown>): AmapPlace {
  return {
    id: stringValue(item.id),
    name: stringValue(item.name) ?? "Unknown place",
    address: stringValue(item.address),
    city: stringValue(item.cityname),
    location: parseLocation(item.location),
    raw: item
  };
}

function parseLocation(value: unknown): GeoPoint | null {
  if (typeof value !== "string") {
    return null;
  }

  const [longitude, latitude] = value.split(",").map((part) => Number(part.trim()));

  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
    return null;
  }

  return { longitude, latitude };
}

function formatPoint(point: GeoPoint): string {
  return `${point.longitude},${point.latitude}`;
}

function readRouteNumber(payload: unknown, key: "distance" | "duration"): number | null {
  if (!isRecord(payload) || !isRecord(payload.route) || !Array.isArray(payload.route.paths)) {
    return null;
  }

  const [firstPath] = payload.route.paths;
  return isRecord(firstPath) ? numberValue(firstPath[key]) : null;
}
