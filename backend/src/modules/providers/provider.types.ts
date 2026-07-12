export type ProviderName = "amap" | "tavily" | "llm";

export type ProviderErrorCode = "not_configured" | "request_failed" | "invalid_response";

export class ProviderError extends Error {
  constructor(
    readonly provider: ProviderName,
    readonly code: ProviderErrorCode,
    message: string,
    readonly statusCode?: number
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

export interface GeoPoint {
  longitude: number;
  latitude: number;
}

export interface AmapPlace {
  id: string | null;
  name: string;
  address: string | null;
  city: string | null;
  adcode: string | null;
  location: GeoPoint | null;
  raw: unknown;
}

export interface AmapRouteEstimate {
  origin: GeoPoint;
  destination: GeoPoint;
  distanceMeters: number | null;
  durationSeconds: number | null;
  strategy: string;
  raw: unknown;
}

export interface AmapLiveWeather {
  province: string | null;
  city: string | null;
  weather: string | null;
  temperatureCelsius: number | null;
  windDirection: string | null;
  windPower: string | null;
  humidityPercent: number | null;
  reportTime: string | null;
}

export interface AmapForecastDay {
  date: string | null;
  week: string | null;
  dayWeather: string | null;
  nightWeather: string | null;
  dayTemperatureCelsius: number | null;
  nightTemperatureCelsius: number | null;
  dayWindDirection: string | null;
  nightWindDirection: string | null;
  dayWindPower: string | null;
  nightWindPower: string | null;
}

export interface AmapWeather {
  city: string;
  adcode: string;
  live: AmapLiveWeather | null;
  forecasts: AmapForecastDay[];
  raw: unknown;
}

export interface SearchPlacesRequest {
  keywords: string;
  city?: string;
  limit?: number;
}

export interface GeocodeRequest {
  address: string;
  city?: string;
}

export interface RouteEstimateRequest {
  origin: GeoPoint;
  destination: GeoPoint;
  strategy?: "walking" | "driving" | "transit";
  city?: string;
}

export interface WeatherRequest {
  city: string;
}

export interface TavilySearchRequest {
  query: string;
  maxResults?: number;
  searchDepth?: "basic" | "advanced";
  includeAnswer?: boolean;
}

export interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  score: number | null;
  raw: unknown;
}

export interface TavilySearchResponse {
  query: string;
  answer: string | null;
  results: TavilySearchResult[];
  raw: unknown;
}

export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmChatRequest {
  messages: LlmMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface LlmChatResponse {
  content: string;
  model: string | null;
  raw: unknown;
}

export interface LlmJsonRequest<TSchema extends Record<string, unknown> = Record<string, unknown>>
  extends LlmChatRequest {
  schemaName?: string;
  schema?: TSchema;
}

export interface LlmJsonResponse<TValue = unknown> extends LlmChatResponse {
  value: TValue;
}
