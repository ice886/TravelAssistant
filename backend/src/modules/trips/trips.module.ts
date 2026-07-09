import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module";
import { TripsController } from "./trips.controller";
import { TripsService } from "./trips.service";

@Module({
  imports: [DatabaseModule],
  controllers: [TripsController],
  providers: [TripsService]
})
export class TripsModule {}
