import { Module } from "@nestjs/common";

import { AppConfigModule } from "./config/app-config.module";
import { DatabaseModule } from "./database/database.module";
import { ProvidersModule } from "./providers/providers.module";

@Module({
  imports: [AppConfigModule, DatabaseModule, ProvidersModule],
  exports: [AppConfigModule, DatabaseModule, ProvidersModule]
})
export class InfrastructureModule {}
