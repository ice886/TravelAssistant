import { Inject, Injectable } from "@nestjs/common";

import { AppConfigService } from "../config/app-config.service";
import { SafetyService } from "../safety/safety.service";
import { McpHttpClient, McpTool } from "./mcp-http-client";
import {
  XhsLoginQrcodeImage,
  XhsLoginQrcodeResponse,
  XhsLoginStatus,
  XhsStatusResponse
} from "./mcp.types";

@Injectable()
export class McpService {
  constructor(
    @Inject(AppConfigService) private readonly config: AppConfigService,
    @Inject(SafetyService) private readonly safety: SafetyService
  ) {}

  async getXhsStatus(): Promise<XhsStatusResponse> {
    const client = this.createClient();

    if (!client) {
      return this.notConfiguredStatus();
    }

    try {
      await client.initialize();
      const tools = await client.listTools();
      const loginStatus = await this.readLoginStatus(client, tools);

      return {
        configured: true,
        connectionStatus: "connected",
        loginStatus,
        tools: tools.map((tool) => ({
          name: tool.name,
          allowed: this.safety.isXhsToolAllowed(tool.name).allowed
        })),
        readonlyTools: this.safety.xhsReadonlyTools,
        blockedTools: this.safety.xhsBlockedTools,
        errorMessage: null
      };
    } catch (error) {
      return {
        configured: true,
        connectionStatus: "unavailable",
        loginStatus: "unknown",
        tools: [],
        readonlyTools: this.safety.xhsReadonlyTools,
        blockedTools: this.safety.xhsBlockedTools,
        errorMessage: normalizeErrorMessage(error)
      };
    }
  }

  async getXhsLoginQrcode(): Promise<XhsLoginQrcodeResponse> {
    const client = this.createClient();

    if (!client) {
      return {
        configured: false,
        connectionStatus: "not_configured",
        loginStatus: "unknown",
        qrcode: null,
        qrcodeText: null,
        imageMimeType: null,
        imageData: null,
        imageDataUrl: null,
        errorMessage: "XHS_MCP_URL is not configured."
      };
    }

    const decision = this.safety.isXhsToolAllowed("get_login_qrcode");
    if (!decision.allowed) {
      return {
        configured: true,
        connectionStatus: "unavailable",
        loginStatus: "unknown",
        qrcode: null,
        qrcodeText: null,
        imageMimeType: null,
        imageData: null,
        imageDataUrl: null,
        errorMessage: decision.reason
      };
    }

    try {
      await client.initialize();
      const qrcode = await client.callTool("get_login_qrcode");
      const qrcodeImage = extractQrcodeImage(qrcode);
      const loginStatus = await this.readLoginStatus(client);

      return {
        configured: true,
        connectionStatus: "connected",
        loginStatus,
        qrcode,
        qrcodeText: extractQrcodeText(qrcode),
        imageMimeType: qrcodeImage?.mimeType ?? null,
        imageData: qrcodeImage?.data ?? null,
        imageDataUrl: qrcodeImage ? `data:${qrcodeImage.mimeType};base64,${qrcodeImage.data}` : null,
        errorMessage: null
      };
    } catch (error) {
      return {
        configured: true,
        connectionStatus: "unavailable",
        loginStatus: "unknown",
        qrcode: null,
        qrcodeText: null,
        imageMimeType: null,
        imageData: null,
        imageDataUrl: null,
        errorMessage: normalizeErrorMessage(error)
      };
    }
  }

  async getXhsLoginQrcodeImage(): Promise<XhsLoginQrcodeImage> {
    const qrcodeResponse = await this.getXhsLoginQrcode();

    if (qrcodeResponse.connectionStatus !== "connected" || !qrcodeResponse.imageData) {
      throw new Error(qrcodeResponse.errorMessage ?? "Xiaohongshu login QR code image is unavailable.");
    }

    return {
      data: Buffer.from(qrcodeResponse.imageData, "base64"),
      mimeType: qrcodeResponse.imageMimeType ?? "image/png"
    };
  }

  private createClient(): McpHttpClient | null {
    if (!this.config.xhsMcpUrl) {
      return null;
    }

    return new McpHttpClient(this.config.xhsMcpUrl);
  }

  private async readLoginStatus(client: McpHttpClient, tools?: McpTool[]): Promise<XhsLoginStatus> {
    const hasLoginTool = tools ? tools.some((tool) => tool.name === "check_login_status") : true;
    const decision = this.safety.isXhsToolAllowed("check_login_status");

    if (!hasLoginTool || !decision.allowed) {
      return "unknown";
    }

    try {
      const result = await client.callTool("check_login_status");
      return normalizeLoginStatus(result);
    } catch {
      return "unknown";
    }
  }

  private notConfiguredStatus(): XhsStatusResponse {
    return {
      configured: false,
      connectionStatus: "not_configured",
      loginStatus: "unknown",
      tools: [],
      readonlyTools: this.safety.xhsReadonlyTools,
      blockedTools: this.safety.xhsBlockedTools,
      errorMessage: "XHS_MCP_URL is not configured."
    };
  }
}

function normalizeLoginStatus(result: unknown): XhsLoginStatus {
  if (typeof result === "boolean") {
    return result ? "logged_in" : "logged_out";
  }

  if (typeof result === "string") {
    const normalized = result.toLowerCase();

    if (normalized.includes("not") || normalized.includes("未登录") || normalized.includes("false")) {
      return "logged_out";
    }

    if (normalized.includes("logged") || normalized.includes("已登录") || normalized.includes("true")) {
      return "logged_in";
    }
  }

  if (typeof result === "object" && result !== null) {
    const record = result as Record<string, unknown>;
    const candidates = [record.loggedIn, record.isLoggedIn, record.login, record.status, record.message];

    for (const candidate of candidates) {
      const status = normalizeLoginStatus(candidate);
      if (status !== "unknown") {
        return status;
      }
    }
  }

  return "unknown";
}

function normalizeErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown MCP request error.";
}

function extractQrcodeText(qrcode: unknown): string | null {
  if (typeof qrcode === "string") {
    return qrcode;
  }

  const content = getToolContent(qrcode);
  const textContent = content.find((item) => item.type === "text" && typeof item.text === "string");

  return typeof textContent?.text === "string" ? textContent.text : null;
}

function extractQrcodeImage(qrcode: unknown): { data: string; mimeType: string } | null {
  const content = getToolContent(qrcode);
  const imageContent = content.find(
    (item) => item.type === "image" && typeof item.data === "string"
  );

  if (!imageContent || typeof imageContent.data !== "string") {
    return null;
  }

  return {
    data: imageContent.data,
    mimeType: typeof imageContent.mimeType === "string" ? imageContent.mimeType : "image/png"
  };
}

function getToolContent(value: unknown): Array<Record<string, unknown>> {
  if (typeof value !== "object" || value === null || !("content" in value)) {
    return [];
  }

  const content = (value as { content?: unknown }).content;

  if (!Array.isArray(content)) {
    return [];
  }

  return content.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null);
}
