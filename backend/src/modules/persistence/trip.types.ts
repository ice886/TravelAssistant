export interface CreateTripRequest {
  destination?: unknown;
  startDate?: unknown;
  endDate?: unknown;
  days?: unknown;
  interests?: unknown;
  budgetLevel?: unknown;
  travelerType?: unknown;
  travelerCount?: unknown;
}

export interface Trip {
  id: string;
  destination: string;
  startDate: string | null;
  endDate: string | null;
  days: number | null;
  interests: string[];
  budgetLevel: string;
  travelerType: string;
  travelerCount: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface TripRow {
  id: string;
  destination: string;
  start_date: string | null;
  end_date: string | null;
  days: number | null;
  interests: string[] | string;
  budget_level: string;
  traveler_type: string;
  traveler_count: number;
  status: string;
  created_at: Date;
  updated_at: Date;
}

