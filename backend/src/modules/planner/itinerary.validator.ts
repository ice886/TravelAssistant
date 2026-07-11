import { BadRequestException } from "@nestjs/common";

import { ItineraryActivity, ItineraryContent, ItineraryDay } from "./planner.types";

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
  if (!isRecord(value) || !hasValidDayFields(value)) {
    throw new BadRequestException(`Invalid itinerary day at index ${index}.`);
  }

  return {
    day: value.day,
    date: value.date,
    title: value.title,
    activities: value.activities.map((activity) =>
      validateActivity(activity, allowedSourceIds)
    ),
    notes: validateStringArray(value.notes, "Itinerary day notes must be strings.")
  };
}

function validateActivity(
  value: unknown,
  allowedSourceIds?: ReadonlySet<string>
): ItineraryActivity {
  if (!isRecord(value) || !hasValidActivityFields(value)) {
    throw new BadRequestException("Invalid itinerary activity.");
  }

  const sourceIds = validateStringArray(
    value.sourceIds,
    "Itinerary source ids must be strings."
  );
  const hasUnknownSource =
    allowedSourceIds && sourceIds.some((sourceId) => !allowedSourceIds.has(sourceId));

  if (hasUnknownSource) {
    throw new BadRequestException("Itinerary referenced an unknown research source.");
  }

  return {
    time: value.time,
    title: value.title,
    location: value.location,
    description: value.description,
    transport: value.transport,
    estimatedCost: value.estimatedCost,
    sourceIds
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
    isNonEmptyString(value.transport) &&
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
