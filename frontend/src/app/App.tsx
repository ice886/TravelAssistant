import { useEffect, useState } from "react";

import { getHealth, HealthResponse } from "../api/client";
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

export function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);

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
          <span
            className={health?.config.xiaohongshuMcp === "configured" ? "status-good" : "status-warn"}
          >
            小红书 {formatConfigStatus(health?.config.xiaohongshuMcp)}
          </span>
        </div>
      </header>

      <section className="workspace">
        <aside className="sidebar">
          <TripForm />
          <AgentRunPanel />
        </aside>
        <section className="main-column">
          <SourcesPanel />
          <ItineraryEditor />
        </section>
      </section>
    </main>
  );
}
