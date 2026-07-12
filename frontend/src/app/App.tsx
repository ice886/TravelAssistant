import { useCallback, useEffect, useRef, useState } from "react";

import { AgentRun, getHealth, getXhsStatus, HealthResponse, Trip, XhsStatusResponse } from "../api/client";
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
  const [currentRun, setCurrentRun] = useState<AgentRun | null>(null);
  const currentTripIdRef = useRef<string | null>(null);
  const activeStep = currentRun?.status === "completed" ? 3 : currentRun ? 2 : currentTrip ? 2 : 1;

  const handleRunChange = useCallback((run: AgentRun | null) => {
    if (!run || run.tripId === currentTripIdRef.current) {
      setCurrentRun(run);
    }
  }, []);

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
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">旅</span>
          <div>
            <p className="eyebrow">TravelAssistant</p>
            <p className="brand-name">旅途灵感工作台</p>
          </div>
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

      <section className="hero" aria-labelledby="workspace-title">
        <div className="hero-copy">
          <p className="eyebrow">从灵感到可出发的行程</p>
          <h1 id="workspace-title">把想去的地方，<span>变成一段好旅程。</span></h1>
          <p className="hero-description">
            告诉我们你的旅行偏好。Agent 会综合真实经验、地图与网页信息，与你一起完成可编辑的行程草稿。
          </p>
        </div>
        <ol className="journey-steps" aria-label="规划进度">
          {["描述旅程", "收集证据", "编辑行程"].map((label, index) => {
            const step = index + 1;
            const state = step < activeStep ? "complete" : step === activeStep ? "active" : "upcoming";
            return (
              <li className={`journey-step journey-step--${state}`} key={label} aria-current={state === "active" ? "step" : undefined}>
                <span className="step-number">{state === "complete" ? "✓" : step}</span>
                <span>{label}</span>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="workspace">
        <aside className="sidebar">
          <TripForm onTripCreated={(trip) => {
            currentTripIdRef.current = trip.id;
            setCurrentTrip(trip);
            setCurrentRun(null);
          }} />
          <AgentRunPanel
            onRunChange={handleRunChange}
            onXhsStatusChange={(status) => {
              setXhsStatus(status);
              setXhsError(null);
            }}
            run={currentRun}
            trip={currentTrip}
          />
        </aside>
        <section className="main-column" aria-label="研究结果与行程">
          <SourcesPanel run={currentRun} trip={currentTrip} />
          <ItineraryEditor trip={currentTrip} />
        </section>
      </section>
    </main>
  );
}
