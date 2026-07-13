import { Module } from "@nestjs/common";

import { McpService } from "./mcp.service";
import { SafetyService } from "./safety.service";

@Module({
  providers: [SafetyService, McpService],
  exports: [McpService]
})
export class McpModule {}
