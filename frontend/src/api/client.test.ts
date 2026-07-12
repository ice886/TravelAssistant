import { afterEach, describe, expect, it, vi } from "vitest";

import {
  generateItinerary,
  getLatestResearchRun,
  getResearchSources,
  getXhsLoginQrcode,
  saveItinerary,
  startResearch
} from "./client";

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

describe("research API", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("starts a background run and preserves progress fields", async () => {
    const payload = {
      id: "run-1",
      status: "running",
      progress: {
        currentRound: 0,
        maxRounds: 8,
        degraded: false,
        degradationReasons: [],
        toolCalls: []
      }
    };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(startResearch("trip-1")).resolves.toEqual(payload);
    expect(fetchMock).toHaveBeenCalledWith("/api/trips/trip-1/research", { method: "POST" });
  });

  it("reads latest run progress and current-run sources", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "run-1", progress: { degraded: false } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: "source-1", provider: "amap" }]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await getLatestResearchRun("trip-1");
    await getResearchSources("trip-1");

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/trips/trip-1/research-runs/latest");
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/trips/trip-1/research-sources");
  });
});
