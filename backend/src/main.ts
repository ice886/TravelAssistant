import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { config as loadEnv } from "dotenv";
import "reflect-metadata";

import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";

import { AppModule } from "./app.module";
import { AppConfigService } from "./modules/config/app-config.service";

const workspaceEnvPath = resolve(process.cwd(), ".env");
const parentEnvPath = resolve(process.cwd(), "../.env");
const workspaceLocalEnvPath = resolve(process.cwd(), ".env.local");
const parentLocalEnvPath = resolve(process.cwd(), "../.env.local");

loadEnvFile(existsSync(workspaceEnvPath) ? workspaceEnvPath : parentEnvPath, false);
loadEnvFile(existsSync(workspaceLocalEnvPath) ? workspaceLocalEnvPath : parentLocalEnvPath, true);

function loadEnvFile(path: string, override: boolean): void {
  if (!existsSync(path)) {
    return;
  }

  loadEnv({
    path,
    override,
    quiet: true
  });
}

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
