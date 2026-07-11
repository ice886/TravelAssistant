import { useEffect, useState } from "react";

import { getHealth, getXhsStatus, HealthResponse, Trip, XhsStatusResponse } from "../api/client";
import { AgentRunPanel } from "../features/agent-run/AgentRunPanel";
import { ItineraryEditor } from "../features/itinerary-editor/ItineraryEditor";
import { SourcesPanel } from "../features/sources/SourcesPanel";
import { TripForm } from "../features/trip-form/TripForm";

function formatConfigStatus(status: "configured" | "missing" | undefined): string {
  if (!status) {
    return "检查中";
  }

  return status === "configured" ? "已配置" : "未配置";
}

function formatXhsStatus(status: XhsStatusResponse | null, error: string | null): string {
  if (error) {
    return "不可用";
  }

  if (!status) {
    return "检查中";
  }

  if (status.connectionStatus === "not_configured") {
    return "未配置";
  }

  if (status.connectionStatus === "unavailable") {
    return "不可用";
  }

  if (status.loginStatus === "logged_in") {
    return "已登录";
  }

  if (status.loginStatus === "logged_out") {
    return "未登录";
  }

  return "已连接";
}

function xhsStatusClass(status: XhsStatusResponse | null, error: string | null): string {
  if (error || status?.connectionStatus === "unavailable") {
    return "status-bad";
  }

  if (status?.connectionStatus === "connected" && status.loginStatus === "logged_in") {
    return "status-good";
  }

  return "status-warn";
}

export function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [xhsStatus, setXhsStatus] = useState<XhsStatusResponse | null>(null);
  const [xhsError, setXhsError] = useState<string | null>(null);
  const [currentTrip, setCurrentTrip] = useState<Trip | null>(null);

  useEffect(() => {
    let active = true;

    getHealth()
      .then((payload) => {
        if (active) {
          setHealth(payload);
          setHealthError(null);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setHealth(null);
          setHealthError(error instanceof Error ? error.message : "健康检查请求失败");
        }
      });

    getXhsStatus()
      .then((payload) => {
        if (active) {
          setXhsStatus(payload);
          setXhsError(null);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setXhsStatus(null);
          setXhsError(error instanceof Error ? error.message : "小红书状态请求失败");
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">TravelAssistant</p>
          <h1>旅行规划工作台</h1>
        </div>
        <div className="status-strip" aria-label="服务状态">
          <span className={healthError ? "status-bad" : "status-good"}>
            API {health?.status === "ok" ? "正常" : healthError ? "离线" : "检查中"}
          </span>
          <span className={health?.config.database === "configured" ? "status-good" : "status-warn"}>
            数据库 {formatConfigStatus(health?.config.database)}
          </span>
          <span className={xhsStatusClass(xhsStatus, xhsError)}>
            小红书 {formatXhsStatus(xhsStatus, xhsError)}
          </span>
        </div>
      </header>

      <section className="workspace">
        <aside className="sidebar">
          <TripForm onTripCreated={setCurrentTrip} />
          <AgentRunPanel
            onXhsStatusChange={(status) => {
              setXhsStatus(status);
              setXhsError(null);
            }}
            trip={currentTrip}
          />
        </aside>
        <section className="main-column">
          <SourcesPanel trip={currentTrip} />
          <ItineraryEditor trip={currentTrip} />
        </section>
      </section>
    </main>
  );
}
