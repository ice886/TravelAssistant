import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module";
import { ProvidersModule } from "../providers/providers.module";
import { TripsModule } from "../trips/trips.module";
import { PlannerController } from "./planner.controller";
import { PlannerService } from "./planner.service";

@Module({ imports: [DatabaseModule, ProvidersModule, TripsModule], controllers: [PlannerController], providers: [PlannerService] })
export class PlannerModule {}
