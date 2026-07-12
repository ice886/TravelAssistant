import { Inject, Injectable } from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";

import { DatabaseService } from "../database/database.service";
import { Trip } from "../trips/trip.types";
import { ResearchSourceDraft, ResearchSourceProvider } from "./research-agent.types";
import { ResearchCacheRow } from "./research.types";

export interface ResearchCacheEntry {
  sources: ResearchSourceDraft[];
  degraded: boolean;
  degradationReasons: string[];
}

@Injectable()
export class ResearchCacheService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  buildKey(trip: Trip, providerProfile: string[] = []): string {
    const payload = {
      version: 2,
      destination: normalizeText(trip.destination),
      interests: [...new Set(trip.interests.map(normalizeText).filter(Boolean))].sort(),
      duration: {
        days: trip.days,
        startDate: trip.startDate,
        endDate: trip.endDate
      },
      budgetLevel: normalizeText(trip.budgetLevel),
      travelerType: normalizeText(trip.travelerType),
      travelerCount: trip.travelerCount,
      providerProfile: [...new Set(providerProfile.map(normalizeText).filter(Boolean))].sort()
    };

    return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  }

  async get(key: string): Promise<ResearchCacheEntry | null> {
    const result = await this.database.query<ResearchCacheRow>(
      `
        SELECT sources, expires_at
        FROM research_cache
        WHERE cache_key = $1 AND expires_at > now()
        LIMIT 1
      `,
      [key]
    );
    const row = result.rows[0];
    if (!row) {
      return null;
    }

    try {
      const sources = typeof row.sources === "string" ? JSON.parse(row.sources) : row.sources;
      const entry = parseCacheEntry(sources);
      return entry.sources.length > 0 ? entry : null;
    } catch {
      return null;
    }
  }

  async set(
    key: string,
    sources: ResearchSourceDraft[],
    ttlSeconds: number,
    degraded: boolean,
    degradationReasons: string[]
  ): Promise<void> {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    await this.database.query(
      `
        INSERT INTO research_cache (id, cache_key, sources, created_at, expires_at)
        VALUES ($1, $2, $3::jsonb, now(), $4)
        ON CONFLICT (cache_key)
        DO UPDATE SET
          sources = EXCLUDED.sources,
          created_at = now(),
          expires_at = EXCLUDED.expires_at
      `,
      [
        randomUUID(),
        key,
        JSON.stringify({ sources, degraded, degradationReasons }),
        expiresAt
      ]
    );
  }
}

function parseCacheEntry(value: unknown): ResearchCacheEntry {
  if (Array.isArray(value)) {
    return {
      sources: value.map(parseCachedSource),
      degraded: false,
      degradationReasons: []
    };
  }
  if (!isRecord(value) || !Array.isArray(value.sources)) {
    throw new Error("Cached research entry is invalid.");
  }

  return {
    sources: value.sources.map(parseCachedSource),
    degraded: value.degraded === true,
    degradationReasons: Array.isArray(value.degradationReasons)
      ? value.degradationReasons.filter((item): item is string => typeof item === "string")
      : []
  };
}

function parseCachedSource(value: unknown): ResearchSourceDraft {
  if (!isRecord(value)) {
    throw new Error("Cached research source must be an object.");
  }

  const provider = value.provider;
  if (provider !== "xiaohongshu" && provider !== "amap" && provider !== "tavily") {
    throw new Error("Cached research source provider is invalid.");
  }

  if (typeof value.title !== "string" || !value.title.trim()) {
    throw new Error("Cached research source title is invalid.");
  }

  return {
    provider: provider as ResearchSourceProvider,
    title: value.title.trim().slice(0, 300),
    url: typeof value.url === "string" ? safeExternalUrl(value.url) : null,
    snippet: typeof value.snippet === "string" ? value.snippet.slice(0, 2000) : null,
    metadata: isRecord(value.metadata) ? value.metadata : {}
  };
}

function normalizeText(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("zh-CN");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeExternalUrl(value: string): string | null {
  if (value.length > 2048) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}
