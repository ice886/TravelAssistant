export type XhsConnectionStatus = "not_configured" | "connected" | "unavailable";
export type XhsLoginStatus = "logged_in" | "logged_out" | "unknown";

export interface XhsToolSummary {
  name: string;
  allowed: boolean;
}

export interface XhsStatusResponse {
  configured: boolean;
  connectionStatus: XhsConnectionStatus;
  loginStatus: XhsLoginStatus;
  tools: XhsToolSummary[];
  readonlyTools: string[];
  blockedTools: string[];
  errorMessage: string | null;
}

export interface XhsLoginQrcodeResponse {
  configured: boolean;
  connectionStatus: XhsConnectionStatus;
  loginStatus: XhsLoginStatus;
  qrcode: unknown;
  qrcodeText: string | null;
  imageMimeType: string | null;
  imageData: string | null;
  imageDataUrl: string | null;
  errorMessage: string | null;
}

export interface XhsLoginQrcodeImage {
  data: Buffer;
  mimeType: string;
}

export interface JsonRpcSuccess {
  jsonrpc: "2.0";
  id: number;
  result: unknown;
}

export interface JsonRpcFailure {
  jsonrpc: "2.0";
  id: number;
  error: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export type JsonRpcResponse = JsonRpcSuccess | JsonRpcFailure;
