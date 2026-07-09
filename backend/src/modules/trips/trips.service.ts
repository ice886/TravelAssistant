import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";

import { DatabaseService } from "../database/database.service";
import { CreateTripRequest, Trip, TripRow } from "./trip.types";

@Injectable()
export class TripsService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  async createTrip(request: CreateTripRequest): Promise<Trip> {
    const input = this.normalizeCreateTrip(request);
    const id = randomUUID();

    const result = await this.database.query<TripRow>(
      `
        INSERT INTO trips (
          id,
          destination,
          start_date,
          end_date,
          days,
          interests,
          budget_level,
          traveler_type,
          traveler_count,
          status
        )
        VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, 'draft')
        RETURNING *
      `,
      [
        id,
        input.destination,
        input.startDate,
        input.endDate,
        input.days,
        JSON.stringify(input.interests),
        input.budgetLevel,
        input.travelerType,
        input.travelerCount
      ]
    );

    return this.toTrip(result.rows[0]);
  }

  async listTrips(): Promise<Trip[]> {
    const result = await this.database.query<TripRow>(`
      SELECT *
      FROM trips
      ORDER BY created_at DESC
    `);

    return result.rows.map((row) => this.toTrip(row));
  }

  async getTrip(id: string): Promise<Trip> {
    if (!this.isUuid(id)) {
      throw new BadRequestException("Trip id must be a UUID.");
    }

    const result = await this.database.query<TripRow>("SELECT * FROM trips WHERE id = $1", [id]);
    const trip = result.rows[0];

    if (!trip) {
      throw new NotFoundException("Trip not found.");
    }

    return this.toTrip(trip);
  }

  private normalizeCreateTrip(request: CreateTripRequest) {
    const destination = this.requiredString(request.destination, "destination");
    const budgetLevel = this.requiredString(request.budgetLevel, "budgetLevel");
    const travelerType = this.requiredString(request.travelerType, "travelerType");
    const interests = this.normalizeInterests(request.interests);
    const days = this.optionalPositiveInteger(request.days, "days");
    const travelerCount = this.optionalPositiveInteger(request.travelerCount, "travelerCount") ?? 1;
    const startDate = this.optionalDate(request.startDate, "startDate");
    const endDate = this.optionalDate(request.endDate, "endDate");

    if (!days && !startDate) {
      throw new BadRequestException("Either days or startDate is required.");
    }

    if (startDate && endDate && startDate > endDate) {
      throw new BadRequestException("endDate must be on or after startDate.");
    }

    return {
      destination,
      startDate,
      endDate,
      days,
      interests,
      budgetLevel,
      travelerType,
      travelerCount
    };
  }

  private requiredString(value: unknown, fieldName: string): string {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new BadRequestException(`${fieldName} is required.`);
    }

    return value.trim();
  }

  private normalizeInterests(value: unknown): string[] {
    if (!Array.isArray(value)) {
      throw new BadRequestException("interests must be an array.");
    }

    const interests = value
      .filter((interest): interest is string => typeof interest === "string")
      .map((interest) => interest.trim())
      .filter(Boolean);

    if (interests.length === 0) {
      throw new BadRequestException("At least one interest is required.");
    }

    return [...new Set(interests)];
  }

  private optionalPositiveInteger(value: unknown, fieldName: string): number | null {
    if (value === undefined || value === null || value === "") {
      return null;
    }

    const parsed = Number(value);

    if (!Number.isInteger(parsed) || parsed < 1) {
      throw new BadRequestException(`${fieldName} must be a positive integer.`);
    }

    return parsed;
  }

  private optionalDate(value: unknown, fieldName: string): string | null {
    if (value === undefined || value === null || value === "") {
      return null;
    }

    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new BadRequestException(`${fieldName} must use YYYY-MM-DD format.`);
    }

    const date = new Date(`${value}T00:00:00.000Z`);

    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
      throw new BadRequestException(`${fieldName} must be a valid date.`);
    }

    return value;
  }

  private isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    );
  }

  private toTrip(row: TripRow): Trip {
    return {
      id: row.id,
      destination: row.destination,
      startDate: row.start_date,
      endDate: row.end_date,
      days: row.days,
      interests: Array.isArray(row.interests) ? row.interests : JSON.parse(row.interests),
      budgetLevel: row.budget_level,
      travelerType: row.traveler_type,
      travelerCount: row.traveler_count,
      status: row.status,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString()
    };
  }
}
