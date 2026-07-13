export interface ItineraryActivity {
  time: string;
  title: string;
  location: string;
  description: string;
  transport: string;
  estimatedCost: number;
  sourceIds: string[];
}

export interface ItineraryDay {
  day: number;
  date: string | null;
  title: string;
  activities: ItineraryActivity[];
  notes: string[];
}

export interface ItineraryContent {
  title: string;
  summary: string;
  currency: string;
  totalEstimatedCost: number;
  days: ItineraryDay[];
  tips: string[];
}

export interface ItineraryVersion {
  id: string;
  tripId: string;
  researchRunId: string | null;
  version: number;
  source: "generated" | "edited";
  content: ItineraryContent;
  createdAt: string;
}

export interface ItineraryVersionRow {
  id: string;
  trip_id: string;
  research_run_id: string | null;
  version: number;
  source: "generated" | "edited";
  content: ItineraryContent | string;
  created_at: Date;
}

export interface PlannerResearchSourceRow {
  id: string;
  run_id: string;
  provider: string;
  title: string;
  snippet: string | null;
  metadata: unknown;
}

