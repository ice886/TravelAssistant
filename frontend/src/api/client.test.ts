import { afterEach, describe, expect, it, vi } from "vitest";

import { generateItinerary, getXhsLoginQrcode, saveItinerary } from "./client";

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

describe("itinerary API", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("starts itinerary generation", async () => {
    const payload = { id: "version-1", version: 1 };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(generateItinerary("trip-1")).resolves.toEqual(payload);
    expect(fetchMock).toHaveBeenCalledWith("/api/trips/trip-1/itineraries/generate", { method: "POST" });
  });

  it("saves edited content as JSON", async () => {
    const content = { title: "行程", summary: "摘要", currency: "CNY", totalEstimatedCost: 0, days: [], tips: [] };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ version: 2 }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await saveItinerary("trip-1", content);
    expect(fetchMock).toHaveBeenCalledWith("/api/trips/trip-1/itineraries", expect.objectContaining({ method: "POST", body: JSON.stringify(content) }));
  });
});
