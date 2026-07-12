import { useCallback, useEffect, useRef, useState } from "react";

import { AgentRun, getHealth, getXhsStatus, HealthResponse, Trip, XhsStatusResponse } from "../api/client";
import { AgentRunPanel } from "../features/agent-run/AgentRunPanel";
import { TravelPlan } from "../features/itinerary-editor/TravelPlan";
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

type WorkspaceStage = 1 | 2 | 3;

const stageLabels: Record<WorkspaceStage, string> = {
  1: "描述旅程",
  2: "收集证据",
  3: "编辑行程"
};

export function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [xhsStatus, setXhsStatus] = useState<XhsStatusResponse | null>(null);
  const [xhsError, setXhsError] = useState<string | null>(null);
  const [currentTrip, setCurrentTrip] = useState<Trip | null>(null);
  const [currentRun, setCurrentRun] = useState<AgentRun | null>(null);
  const [activeStage, setActiveStage] = useState<WorkspaceStage>(1);
  const currentTripIdRef = useRef<string | null>(null);
  const completedResearch = currentRun?.status === "completed";

  const handleRunChange = useCallback((run: AgentRun | null) => {
    if (!run || run.tripId === currentTripIdRef.current) {
      setCurrentRun(run);
      setActiveStage(run?.status === "completed" ? 3 : run ? 2 : currentTripIdRef.current ? 2 : 1);
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

  function canVisitStage(stage: WorkspaceStage): boolean {
    if (stage === 1) {
      return true;
    }

    if (stage === 2) {
      return Boolean(currentTrip);
    }

    return Boolean(completedResearch);
  }

  function renderStageContent() {
    if (activeStage === 1) {
      return (
        <section className="stage-view" aria-labelledby="stage-title-1">
          <div className="stage-view-heading">
            <div>
              <p className="eyebrow">第一步 · 旅行画像</p>
              <h2 id="stage-title-1">先把这次旅行说清楚</h2>
            </div>
            <p className="muted">填写目的地和偏好，马上开始整理线索。</p>
          </div>
          <TripForm onTripCreated={(trip) => {
            currentTripIdRef.current = trip.id;
            setCurrentTrip(trip);
            setCurrentRun(null);
            setActiveStage(2);
          }} />
          <div className="stage-actions stage-actions--end">
            <button disabled={!currentTrip} type="button" onClick={() => setActiveStage(2)}>
              下一步：收集证据
            </button>
          </div>
        </section>
      );
    }

    if (activeStage === 2) {
      return (
        <section className="stage-view" aria-labelledby="stage-title-2">
          <div className="stage-view-heading">
            <div>
              <p className="eyebrow">第二步 · 多来源研究</p>
              <h2 id="stage-title-2">先看证据，再决定怎么走</h2>
            </div>
            <p className="muted">研究进行中可以停留在这里，完成后再进入行程编辑。</p>
          </div>
          <div className="stage-columns">
            <AgentRunPanel
              onRunChange={handleRunChange}
              onXhsStatusChange={(status) => {
                setXhsStatus(status);
                setXhsError(null);
              }}
              run={currentRun}
              trip={currentTrip}
            />
            <SourcesPanel run={currentRun} trip={currentTrip} />
          </div>
          <div className="stage-actions">
            <button className="secondary-button" type="button" onClick={() => setActiveStage(1)}>
              上一步：查看旅行画像
            </button>
            <button disabled={!completedResearch} type="button" onClick={() => setActiveStage(3)}>
              下一步：编辑行程
            </button>
          </div>
        </section>
      );
    }

    return (
      <section className="stage-view" aria-labelledby="stage-title-3">
        <div className="stage-view-heading">
          <div>
          <p className="eyebrow">第三步 · 旅行计划</p>
            <h2 id="stage-title-3">把线索变成可以出发的计划</h2>
          </div>
          <p className="muted">生成后可以查看每天的安排、地点、时间和预算。</p>
        </div>
        <TravelPlan trip={currentTrip} />
        <div className="stage-actions">
          <button className="secondary-button" type="button" onClick={() => setActiveStage(2)}>
            上一步：查看研究证据
          </button>
        </div>
      </section>
    );
  }

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
          <h1 id="workspace-title"><span>去有风的地方</span></h1>
          <p className="hero-description">
            告诉我们你想去哪里。Agent 会综合真实经验、地图与网页信息，为你整理一份清晰的旅行计划。
          </p>
        </div>
        <nav aria-label="规划进度">
          <ol className="journey-steps">
            {([1, 2, 3] as WorkspaceStage[]).map((step) => {
              const state = step === activeStage ? "active" : canVisitStage(step) && step < activeStage ? "complete" : "upcoming";
              return (
                <li className={`journey-step journey-step--${state}`} key={step}>
                  <span className="step-number">{state === "complete" ? "✓" : step}</span>
                  <button
                    className="journey-step-control"
                    aria-current={state === "active" ? "step" : undefined}
                    disabled={!canVisitStage(step)}
                    type="button"
                    onClick={() => setActiveStage(step)}
                  >
                    {stageLabels[step]}
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
      </section>

      <section className="workspace" aria-label={`${stageLabels[activeStage]}工作区`}>
        {renderStageContent()}
      </section>
    </main>
  );
}
