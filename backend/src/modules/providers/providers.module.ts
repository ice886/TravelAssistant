import { Module } from "@nestjs/common";

import { AmapProviderService } from "./amap.service";
import { LlmProviderService } from "./llm.service";
import { TavilyProviderService } from "./tavily.service";

@Module({
  providers: [AmapProviderService, TavilyProviderService, LlmProviderService],
  exports: [AmapProviderService, TavilyProviderService, LlmProviderService]
})
export class ProvidersModule {}
