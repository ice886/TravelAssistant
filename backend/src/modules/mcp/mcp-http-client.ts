import { JsonRpcFailure, JsonRpcResponse } from "./mcp.types";

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: unknown;
}

interface ToolCallContent {
  type?: string;
  mimeType?: string;
  text?: string;
  data?: unknown;
  [key: string]: unknown;
}

export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: unknown;
}

export class McpHttpClient {
  private nextId = 1;
  private sessionId: string | null = null;

  constructor(private readonly endpoint: string) {}

  async initialize(): Promise<void> {
    await this.request("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: {
        name: "travel-assistant-api",
        version: "0.1.0"
      }
    });
  }

  async listTools(): Promise<McpTool[]> {
    const result = await this.request("tools/list");

    if (!isRecord(result) || !Array.isArray(result.tools)) {
      return [];
    }

    return result.tools.filter(isMcpTool);
  }

  async callTool(name: string, args: Record<string, unknown> = {}): Promise<unknown> {
    const result = await this.request("tools/call", {
      name,
      arguments: args
    });

    return unwrapToolResult(result);
  }

  private async request(method: string, params?: unknown): Promise<unknown> {
    const payload: JsonRpcRequest = {
      jsonrpc: "2.0",
      id: this.nextId,
      method,
      ...(params === undefined ? {} : { params })
    };
    this.nextId += 1;

    const headers: Record<string, string> = {
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json"
    };

    if (this.sessionId) {
      headers["Mcp-Session-Id"] = this.sessionId;
    }

    const response = await fetch(this.endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });

    const responseSessionId = response.headers.get("Mcp-Session-Id");
    if (responseSessionId) {
      this.sessionId = responseSessionId;
    }

    if (!response.ok) {
      throw new Error(`MCP request failed: ${response.status} ${response.statusText}`);
    }

    const rpcResponse = await parseJsonRpcResponse(response);

    if ("error" in rpcResponse) {
      throw new Error(formatJsonRpcError(rpcResponse));
    }

    return rpcResponse.result;
  }
}

async function parseJsonRpcResponse(response: Response): Promise<JsonRpcResponse> {
  const body = await response.text();
  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("text/event-stream") ? parseEventStreamPayload(body) : JSON.parse(body);

  if (!isJsonRpcResponse(payload)) {
    throw new Error("MCP response is not a valid JSON-RPC response.");
  }

  return payload;
}

function parseEventStreamPayload(body: string): unknown {
  const dataLine = body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.startsWith("data:"));

  if (!dataLine) {
    throw new Error("MCP event-stream response did not include a data line.");
  }

  return JSON.parse(dataLine.slice("data:".length).trim());
}

function formatJsonRpcError(response: JsonRpcFailure): string {
  return `MCP JSON-RPC error ${response.error.code}: ${response.error.message}`;
}

function unwrapToolResult(result: unknown): unknown {
  if (!isRecord(result) || !Array.isArray(result.content)) {
    return result;
  }

  if (result.isError === true) {
    const errorText = result.content
      .filter(isToolCallContent)
      .map((item) => item.text)
      .filter((text): text is string => typeof text === "string" && text.trim().length > 0)
      .join(" ");

    throw new Error(errorText || "MCP tool call failed.");
  }

  const content = result.content.filter(isToolCallContent);

  if (content.length === 0) {
    return result;
  }

  if (content.length > 1) {
    return {
      content
    };
  }

  const [firstContent] = content;

  if (firstContent.type === "text" && firstContent.text) {
    try {
      return JSON.parse(firstContent.text);
    } catch {
      return firstContent.text;
    }
  }

  return firstContent;
}

function isMcpTool(value: unknown): value is McpTool {
  return isRecord(value) && typeof value.name === "string";
}

function isToolCallContent(value: unknown): value is ToolCallContent {
  return isRecord(value) && typeof value.type === "string";
}

function isJsonRpcResponse(value: unknown): value is JsonRpcResponse {
  if (!isRecord(value) || value.jsonrpc !== "2.0" || typeof value.id !== "number") {
    return false;
  }

  return "result" in value || (isRecord(value.error) && typeof value.error.message === "string");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
