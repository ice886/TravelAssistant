import "reflect-metadata";

import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";

import { AppModule } from "./app.module";
import { AppConfigService } from "./modules/config/app-config.service";

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
    {
      logger: ["log", "error", "warn"]
    }
  );
  const config = app.get(AppConfigService);

  app.enableCors({
    origin: config.webOrigin
  });
  app.setGlobalPrefix("api");

  await app.listen(config.apiPort, "0.0.0.0");
  console.log(`TravelAssistant API listening on port ${config.apiPort}`);
}

void bootstrap();
