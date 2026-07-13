import { Inject, Injectable } from "@nestjs/common";

import { AppConfigService } from "../config/app-config.service";
import {
  AmapPlace,
  AmapRouteEstimate,
  AmapWeather,
  GeocodeRequest,
  GeoPoint,
  ProviderError,
  RouteEstimateRequest,
  SearchPlacesRequest,
  WeatherRequest
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
      adcode: stringValue(item.adcode),
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
    const path =
      strategy === "walking"
        ? "/direction/walking"
        : strategy === "transit"
          ? "/direction/transit/integrated"
          : "/direction/driving";
    const payload = await requestJson(
      "amap",
      fetchFn,
      this.buildUrl(path, {
        key: amapConfig.apiKey,
        origin: formatPoint(request.origin),
        destination: formatPoint(request.destination),
        city: request.city
      }),
      { method: "GET" },
      amapConfig.timeoutMs
    );

    assertAmapSuccess(payload);

    const estimate = {
      origin: request.origin,
      destination: request.destination,
      distanceMeters: readRouteNumber(payload, "distance"),
      durationSeconds: readRouteNumber(payload, "duration"),
      strategy,
      raw: payload
    };

    if (estimate.distanceMeters === null && estimate.durationSeconds === null) {
      throw new ProviderError("amap", "invalid_response", "Amap route response did not include an estimate.");
    }

    return estimate;
  }

  async getWeather(request: WeatherRequest, fetchFn: FetchFn = fetch): Promise<AmapWeather> {
    const amapConfig = this.config.amap;
    assertConfigured("amap", Boolean(amapConfig.apiKey), "AMAP_API_KEY is not configured.");

    const adcode = await this.resolveWeatherAdcode(request.city, fetchFn);
    const requestWeather = (extensions: "base" | "all") =>
      requestJson(
        "amap",
        fetchFn,
        this.buildUrl("/weather/weatherInfo", {
          key: amapConfig.apiKey,
          city: adcode,
          extensions
        }),
        { method: "GET" },
        amapConfig.timeoutMs
      );

    const [livePayload, forecastPayload] = await Promise.all([
      requestWeather("base"),
      requestWeather("all")
    ]);
    assertAmapSuccess(livePayload);
    assertAmapSuccess(forecastPayload);

    const live = normalizeLiveWeather(livePayload);
    const forecasts = normalizeForecasts(forecastPayload);
    if (!live && forecasts.length === 0) {
      throw new ProviderError("amap", "invalid_response", "Amap weather response did not include weather data.");
    }

    return {
      city: request.city,
      adcode,
      live,
      forecasts,
      raw: {
        live: livePayload,
        forecast: forecastPayload
      }
    };
  }

  private async resolveWeatherAdcode(city: string, fetchFn: FetchFn): Promise<string> {
    if (/^\d{6}$/.test(city.trim())) {
      return city.trim();
    }

    const matches = await this.geocode({ address: city, city }, fetchFn);
    const adcode = matches.find((match) => match.adcode)?.adcode;
    if (!adcode) {
      throw new ProviderError("amap", "invalid_response", "Amap could not resolve a weather adcode.");
    }
    return adcode;
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
    adcode: stringValue(item.adcode),
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
  if (!isRecord(payload) || !isRecord(payload.route)) {
    return null;
  }

  const candidates = Array.isArray(payload.route.paths)
    ? payload.route.paths
    : Array.isArray(payload.route.transits)
      ? payload.route.transits
      : [];
  const [firstPath] = candidates;
  return isRecord(firstPath) ? numberValue(firstPath[key]) : null;
}

function normalizeLiveWeather(payload: unknown): AmapWeather["live"] {
  if (!isRecord(payload) || !Array.isArray(payload.lives)) {
    return null;
  }

  const live = payload.lives.find(isRecord);
  if (!live) {
    return null;
  }

  return {
    province: stringValue(live.province),
    city: stringValue(live.city),
    weather: stringValue(live.weather),
    temperatureCelsius: numberValue(live.temperature),
    windDirection: stringValue(live.winddirection),
    windPower: stringValue(live.windpower),
    humidityPercent: numberValue(live.humidity),
    reportTime: stringValue(live.reporttime)
  };
}

function normalizeForecasts(payload: unknown): AmapWeather["forecasts"] {
  if (!isRecord(payload) || !Array.isArray(payload.forecasts)) {
    return [];
  }

  const forecast = payload.forecasts.find(isRecord);
  if (!forecast || !Array.isArray(forecast.casts)) {
    return [];
  }

  return forecast.casts.filter(isRecord).map((item) => ({
    date: stringValue(item.date),
    week: stringValue(item.week),
    dayWeather: stringValue(item.dayweather),
    nightWeather: stringValue(item.nightweather),
    dayTemperatureCelsius: numberValue(item.daytemp),
    nightTemperatureCelsius: numberValue(item.nighttemp),
    dayWindDirection: stringValue(item.daywind),
    nightWindDirection: stringValue(item.nightwind),
    dayWindPower: stringValue(item.daypower),
    nightWindPower: stringValue(item.nightpower)
  }));
}

