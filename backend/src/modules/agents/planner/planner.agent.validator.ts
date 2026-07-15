import { BadRequestException } from "@nestjs/common";

import { ItineraryActivity, ItineraryContent, ItineraryDay } from "../../persistence/planner.types";

export function validateItinerary(
  value: unknown,
  allowedSourceIds?: ReadonlySet<string>
): ItineraryContent {
  if (!isRecord(value) || !hasValidTopLevelFields(value)) {
    throw new BadRequestException("Invalid itinerary content.");
  }

  return {
    title: value.title,
    summary: value.summary,
    currency: value.currency,
    totalEstimatedCost: value.totalEstimatedCost,
    days: value.days.map((day, index) => validateDay(day, index, allowedSourceIds)),
    tips: validateStringArray(value.tips, "Itinerary tips must be strings.")
  };
}

function validateDay(
  value: unknown,
  index: number,
  allowedSourceIds?: ReadonlySet<string>
): ItineraryDay {
  const normalizedValue = normalizeDay(value);

  if (!normalizedValue || !hasValidDayFields(normalizedValue)) {
    throw new BadRequestException(`Invalid itinerary day at index ${index}.`);
  }

  return {
    day: normalizedValue.day,
    date: normalizedValue.date,
    title: normalizedValue.title,
    activities: normalizedValue.activities.map((activity) =>
      validateActivity(activity, allowedSourceIds)
    ),
    notes: validateStringArray(normalizedValue.notes, "Itinerary day notes must be strings.")
  };
}

function validateActivity(
  value: unknown,
  allowedSourceIds?: ReadonlySet<string>
): ItineraryActivity {
  const normalizedValue = normalizeActivity(value);

  if (!normalizedValue || !hasValidActivityFields(normalizedValue)) {
    throw new BadRequestException("Invalid itinerary activity.");
  }

  const sourceIds = validateStringArray(
    normalizedValue.sourceIds,
    "Itinerary source ids must be strings."
  );
  const knownSourceIds = allowedSourceIds
    ? sourceIds.filter((sourceId) => allowedSourceIds.has(sourceId))
    : sourceIds;

  return {
    time: normalizedValue.time,
    title: normalizedValue.title,
    location: normalizedValue.location,
    description: normalizedValue.description,
    transport: normalizedValue.transport,
    estimatedCost: normalizedValue.estimatedCost,
    sourceIds: [...new Set(knownSourceIds)]
  };
}

function normalizeDay(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value)) {
    return null;
  }

  return {
    ...value,
    date: value.date === undefined ? null : value.date,
    notes: value.notes === undefined ? [] : value.notes
  };
}

function normalizeActivity(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value)) {
    return null;
  }

  return {
    ...value,
    transport: value.transport === undefined ? "" : value.transport,
    sourceIds: value.sourceIds === undefined ? [] : value.sourceIds
  };
}

function hasValidTopLevelFields(value: Record<string, unknown>): value is Record<string, unknown> & {
  title: string;
  summary: string;
  currency: string;
  totalEstimatedCost: number;
  days: unknown[];
  tips: unknown[];
} {
  return (
    isNonEmptyString(value.title) &&
    isNonEmptyString(value.summary) &&
    isNonEmptyString(value.currency) &&
    isNonNegativeNumber(value.totalEstimatedCost) &&
    Array.isArray(value.days) &&
    Array.isArray(value.tips)
  );
}

function hasValidDayFields(value: Record<string, unknown>): value is Record<string, unknown> & {
  day: number;
  date: string | null;
  title: string;
  activities: unknown[];
  notes: unknown[];
} {
  return (
    Number.isInteger(value.day) &&
    (value.date === null || isNonEmptyString(value.date)) &&
    isNonEmptyString(value.title) &&
    Array.isArray(value.activities) &&
    Array.isArray(value.notes)
  );
}

function hasValidActivityFields(
  value: Record<string, unknown>
): value is Record<string, unknown> & {
  time: string;
  title: string;
  location: string;
  description: string;
  transport: string;
  estimatedCost: number;
  sourceIds: unknown[];
} {
  return (
    isNonEmptyString(value.time) &&
    isNonEmptyString(value.title) &&
    isNonEmptyString(value.location) &&
    isNonEmptyString(value.description) &&
    typeof value.transport === "string" &&
    isNonNegativeNumber(value.estimatedCost) &&
    Array.isArray(value.sourceIds)
  );
}

function validateStringArray(value: unknown[], message: string): string[] {
  if (!value.every((item): item is string => typeof item === "string")) {
    throw new BadRequestException(message);
  }

  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}
