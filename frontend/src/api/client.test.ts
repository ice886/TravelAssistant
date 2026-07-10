import { afterEach, describe, expect, it, vi } from "vitest";

import { getXhsLoginQrcode } from "./client";

describe("xhs login API", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the QR code payload for the login recovery flow", async () => {
    const payload = {
      configured: true,
      connectionStatus: "connected",
      loginStatus: "logged_out",
      qrcode: null,
      qrcodeText: "请扫码登录",
      imageMimeType: "image/png",
      imageData: "base64-data",
      imageDataUrl: "data:image/png;base64,base64-data",
      errorMessage: null
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(getXhsLoginQrcode()).resolves.toEqual(payload);
    expect(fetchMock).toHaveBeenCalledWith("/api/xhs/login-qrcode");
  });
});
