import { Inject, Injectable } from "@nestjs/common";

import { AppConfigService } from "../config/app-config.service";

@Injectable()
export class HealthService {
  constructor(@Inject(AppConfigService) private readonly config: AppConfigService) {}

  getHealth() {
    return {
      status: "ok",
      service: "travel-assistant-api",
      config: this.config.publicStatus
    };
  }
}
