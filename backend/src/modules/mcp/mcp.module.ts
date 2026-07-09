import { Module } from "@nestjs/common";

import { SafetyModule } from "../safety/safety.module";
import { McpController } from "./mcp.controller";
import { McpService } from "./mcp.service";

@Module({
  imports: [SafetyModule],
  controllers: [McpController],
  providers: [McpService],
  exports: [McpService]
})
export class McpModule {}
