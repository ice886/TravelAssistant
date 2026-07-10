import { useEffect, useState } from "react";

import { AgentRun, AgentRunCheck, getLatestResearchRun, startResearch, Trip } from "../../api/client";

const steps: Array<{
  key: keyof AgentRun["checks"];
  label: string;
}> = [
  { key: "llm", label: "检查 LLM 配置" },
  { key: "amap", label: "检查高德地图配置" },
  { key: "tavily", label: "检查 Tavily 配置" },
  { key: "xiaohongshu", label: "等待小红书登录状态" }
];

interface AgentRunPanelProps {
  trip: Trip | null;
}

function formatRunStatus(run: AgentRun | null): string {
  if (!run) {
    return "待开始";
  }

  const labels: Record<AgentRun["status"], string> = {
    running: "运行中",
    completed: "已完成",
    blocked_config: "缺少配置",
    waiting_login: "等待登录",
    failed: "失败"
  };

  return labels[run.status];
}

function formatCheckStatus(check: AgentRunCheck | undefined): string {
  if (!check) {
    return "待开始";
  }

  const labels: Record<AgentRunCheck["status"], string> = {
    passed: "已通过",
    missing: "缺配置",
    waiting: "等待中",
    unavailable: "不可用",
    skipped: "已跳过"
  };

  return labels[check.status];
}

function checkClassName(check: AgentRunCheck | undefined): string {
  if (!check) {
    return "pill";
  }

  if (check.status === "passed") {
    return "pill status-good";
  }

  if (check.status === "missing" || check.status === "unavailable") {
    return "pill status-bad";
  }

  return "pill status-warn";
}

function shouldPoll(run: AgentRun | null): boolean {
  return run?.status === "running";
}

export function AgentRunPanel({ trip }: AgentRunPanelProps) {
  const [run, setRun] = useState<AgentRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    setRun(null);
    setError(null);
  }, [trip?.id]);

  useEffect(() => {
    if (!trip || !shouldPoll(run)) {
      return;
    }

    const interval = window.setInterval(() => {
      getLatestResearchRun(trip.id)
        .then((payload) => {
          setRun(payload);
          setError(null);
        })
        .catch((pollError: unknown) => {
          setError(pollError instanceof Error ? pollError.message : "研究状态请求失败");
        });
    }, 3000);

    return () => {
      window.clearInterval(interval);
    };
  }, [run, trip]);

  async function handleStartResearch() {
    if (!trip) {
      return;
    }

    setIsStarting(true);
    setError(null);

    try {
      const nextRun = await startResearch(trip.id);
      setRun(nextRun);
    } catch (startError: unknown) {
      setError(startError instanceof Error ? startError.message : "研究任务启动失败");
    } finally {
      setIsStarting(false);
    }
  }

  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>Agent 运行</h2>
        <span className="pill">{formatRunStatus(run)}</span>
      </div>
      <button disabled={!trip || isStarting} type="button" onClick={handleStartResearch}>
        {isStarting ? "启动中..." : "启动研究"}
      </button>
      {trip ? <p className="muted">当前计划：{trip.destination}</p> : <p className="muted">先创建旅行计划。</p>}
      {run?.summary ? <p className="success-text">{run.summary}</p> : null}
      {run?.errorMessage ? <p className="error-text">{run.errorMessage}</p> : null}
      {error ? <p className="error-text">{error}</p> : null}
      <div className="timeline">
        {steps.map((step) => {
          const check = run?.checks[step.key];

          return (
            <div className="timeline-item" key={step.key}>
              <span className={checkClassName(check)}>{formatCheckStatus(check)}</span>
              <p className="muted">{step.label}</p>
              {check?.message ? <p>{check.message}</p> : null}
            </div>
          );
        })}
        {run ? (
          <div className="timeline-item">
            <span className="pill status-good">{run.sourceCount}</span>
            <p className="muted">已记录来源数量</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
