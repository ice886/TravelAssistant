import { Controller, Get, HttpException, HttpStatus, Inject, Res } from "@nestjs/common";
import { FastifyReply } from "fastify";

import { McpService } from "../mcp/mcp.service";

@Controller("xhs")
export class McpController {
  constructor(@Inject(McpService) private readonly mcp: McpService) {}
  @Get("status") getStatus() { return this.mcp.getXhsStatus(); }
  @Get("login-qrcode") getLoginQrcode() { return this.mcp.getXhsLoginQrcode(); }
  @Get("login-qrcode/image") async getLoginQrcodeImage(@Res() response: FastifyReply) {
    try {
      const image = await this.mcp.getXhsLoginQrcodeImage();
      response.header("Content-Type", image.mimeType);
      response.header("Cache-Control", "no-store");
      return response.send(image.data);
    } catch (error) {
      throw new HttpException(error instanceof Error ? error.message : "Xiaohongshu login QR code image is unavailable.", HttpStatus.SERVICE_UNAVAILABLE);
    }
  }
}
