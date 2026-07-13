import { Controller, Get, Inject } from "@nestjs/common";

import { AppConfigService } from "../infrastructure/config/app-config.service";

@Controller("health")
export class HealthController {
  constructor(@Inject(AppConfigService) private readonly config: AppConfigService) {}
  @Get() getHealth() { return { status: "ok", service: "travel-assistant-api", config: this.config.publicStatus }; }
}
