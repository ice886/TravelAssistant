import { Controller, Get, HttpException, HttpStatus, Inject, Res } from "@nestjs/common";
import { FastifyReply } from "fastify";

import { McpService } from "./mcp.service";

@Controller("xhs")
export class McpController {
  constructor(@Inject(McpService) private readonly mcpService: McpService) {}

  @Get("status")
  getStatus() {
    return this.mcpService.getXhsStatus();
  }

  @Get("login-qrcode")
  getLoginQrcode() {
    return this.mcpService.getXhsLoginQrcode();
  }

  @Get("login-qrcode/image")
  async getLoginQrcodeImage(@Res() response: FastifyReply) {
    try {
      const image = await this.mcpService.getXhsLoginQrcodeImage();

      response.header("Content-Type", image.mimeType);
      response.header("Cache-Control", "no-store");
      return response.send(image.data);
    } catch (error) {
      throw new HttpException(
        error instanceof Error ? error.message : "Xiaohongshu login QR code image is unavailable.",
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }
  }
}
