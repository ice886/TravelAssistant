export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "/api";

export interface HealthResponse {
  status: string;
  service: string;
  config: {
    nodeEnv: string;
    apiPort: number;
    webOrigin: string;
    database: "configured" | "missing";
    xiaohongshuMcp: "configured" | "missing";
    llm: "configured" | "missing";
    amap: "configured" | "missing";
    tavily: "configured" | "missing";
  };
}

export interface CreateTripPayload {
  destination: string;
  days?: number;
  startDate?: string;
  endDate?: string;
  interests: string[];
  budgetLevel: string;
  travelerType: string;
  travelerCount: number;
}

export interface Trip {
  id: string;
  destination: string;
  startDate: string | null;
  endDate: string | null;
  days: number | null;
  interests: string[];
  budgetLevel: string;
  travelerType: string;
  travelerCount: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export async function getHealth(): Promise<HealthResponse> {
  const response = await fetch(`${apiBaseUrl}/health`);

  if (!response.ok) {
    throw new Error(`健康检查请求失败：${response.status}`);
  }

  return response.json();
}

export async function createTrip(payload: CreateTripPayload): Promise<Trip> {
  const response = await fetch(`${apiBaseUrl}/trips`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const message = await readErrorMessage(response);
    throw new Error(message ?? `旅行计划请求失败：${response.status}`);
  }

  return response.json();
}

async function readErrorMessage(response: Response): Promise<string | null> {
  try {
    const payload = (await response.json()) as { message?: unknown };

    if (typeof payload.message === "string") {
      return payload.message;
    }
  } catch {
    return null;
  }

  return null;
}
