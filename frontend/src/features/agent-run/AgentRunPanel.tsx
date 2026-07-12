import { useEffect, useState } from "react";

import {
  AgentRun,
  AgentRunCheck,
  getLatestResearchRun,
  getXhsLoginQrcode,
  getXhsStatus,
  startResearch,
  Trip,
  XhsLoginQrcodeResponse
} from "../../api/client";
import { researchToolLabel, researchToolStatusLabel } from "./researchPresentation";

const steps: Array<{
  key: keyof AgentRun["checks"];
  label: string;
}> = [
  { key: "llm", label: "检查 LLM 配置" },
  { key: "amap", label: "检查高德地图配置" },
  { key: "tavily", label: "检查 Tavily 配置" },
  { key: "xiaohongshu", label: "检查小红书可用性" }
];

interface AgentRunPanelProps {
  onXhsStatusChange: (status: Awaited<ReturnType<typeof getXhsStatus>>) => void;
  onRunChange: (run: AgentRun | null) => void;
  run: AgentRun | null;
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

export function AgentRunPanel({ onRunChange, onXhsStatusChange, run, trip }: AgentRunPanelProps) {
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [qrcode, setQrcode] = useState<XhsLoginQrcodeResponse | null>(null);
  const [isLoadingQrcode, setIsLoadingQrcode] = useState(false);
  const [isCheckingLogin, setIsCheckingLogin] = useState(false);

  useEffect(() => {
    setError(null);
    setQrcode(null);
  }, [trip?.id]);

  useEffect(() => {
    const tripId = trip?.id;
    const runId = run?.id;
    if (!tripId || !runId || !shouldPoll(run) || run.tripId !== tripId) {
      return;
    }

    let active = true;
    let timeoutId: number | null = null;
    const poll = async () => {
      try {
        const payload = await getLatestResearchRun(tripId);
        if (active && payload.tripId === tripId && payload.id === runId) {
          onRunChange(payload);
          setError(null);
        }
      } catch (pollError) {
        if (active) {
          setError(pollError instanceof Error ? pollError.message : "研究状态请求失败");
        }
      } finally {
        if (active) timeoutId = window.setTimeout(poll, 3000);
      }
    };
    timeoutId = window.setTimeout(poll, 3000);

    return () => {
      active = false;
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    };
  }, [onRunChange, run?.id, run?.status, run?.tripId, trip?.id]);

  async function handleStartResearch() {
    if (!trip) {
      return;
    }

    setIsStarting(true);
    setError(null);

    try {
      const nextRun = await startResearch(trip.id);
      onRunChange(nextRun);
    } catch (startError: unknown) {
      setError(startError instanceof Error ? startError.message : "研究任务启动失败");
    } finally {
      setIsStarting(false);
    }
  }

  async function handleLoadQrcode() {
    setIsLoadingQrcode(true);
    setError(null);

    try {
      const nextQrcode = await getXhsLoginQrcode();
      setQrcode(nextQrcode);
      onXhsStatusChange({
        configured: nextQrcode.configured,
        connectionStatus: nextQrcode.connectionStatus,
        loginStatus: nextQrcode.loginStatus,
        tools: [],
        readonlyTools: [],
        blockedTools: [],
        errorMessage: nextQrcode.errorMessage
      });
    } catch (qrcodeError: unknown) {
      setError(qrcodeError instanceof Error ? qrcodeError.message : "登录二维码请求失败");
    } finally {
      setIsLoadingQrcode(false);
    }
  }

  async function handleCheckLogin() {
    if (!trip) {
      return;
    }

    setIsCheckingLogin(true);
    setError(null);

    try {
      const status = await getXhsStatus();
      onXhsStatusChange(status);

      if (status.loginStatus !== "logged_in") {
        setError(
          status.errorMessage ??
            (status.connectionStatus === "unavailable"
              ? "小红书 MCP 暂不可用，请确认服务已启动。"
              : "尚未检测到小红书登录，请扫码后重试。")
        );
        return;
      }

      const nextRun = await startResearch(trip.id);
      onRunChange(nextRun);
      setQrcode(null);
    } catch (checkError: unknown) {
      setError(checkError instanceof Error ? checkError.message : "登录状态检查失败");
    } finally {
      setIsCheckingLogin(false);
    }
  }

  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>Agent 运行</h2>
        <span className="pill">{formatRunStatus(run)}</span>
      </div>
      <button disabled={!trip || isStarting || run?.status === "running"} type="button" onClick={handleStartResearch}>
        {isStarting ? "启动中..." : "启动研究"}
      </button>
      {trip ? <p className="muted">当前计划：{trip.destination}</p> : <p className="muted">先创建旅行计划。</p>}
      {run?.summary ? <p className={run.status === "failed" || run.status === "blocked_config" ? "error-text" : "success-text"}>{run.summary}</p> : null}
      {run?.errorMessage ? <p className="error-text" role="alert">{run.errorMessage}</p> : null}
      {error ? <p className="error-text" role="alert">{error}</p> : null}
      {run?.progress.cacheHit ? (
        <p className="cache-notice" role="status">命中研究缓存，本次未执行 Agent 工具循环。</p>
      ) : null}
      {run?.progress.degraded ? (
        <div className="degraded-notice" role="status">
          <strong>部分来源不可用，已使用备用来源继续。</strong>
          {run.progress.degradationReasons.map((reason) => <p key={reason}>{reason}</p>)}
        </div>
      ) : null}
      {run?.status === "waiting_login" ? (
        <div className="login-recovery">
          <div className="login-recovery-heading">
            <div>
              <h3>登录小红书后继续</h3>
              <p className="muted">仅用于读取公开旅行内容，不会执行发布、评论或点赞操作。</p>
            </div>
            <button disabled={isLoadingQrcode} type="button" onClick={handleLoadQrcode}>
              {isLoadingQrcode ? "获取中..." : qrcode ? "刷新二维码" : "显示二维码"}
            </button>
          </div>
          {qrcode?.imageDataUrl ? (
            <img className="login-qrcode" src={qrcode.imageDataUrl} alt="小红书登录二维码" />
          ) : null}
          {qrcode?.loginStatus === "logged_in" ? (
            <p className="success-text">已检测到登录，可以继续研究。</p>
          ) : null}
          {qrcode?.errorMessage ? <p className="error-text">{qrcode.errorMessage}</p> : null}
          <button disabled={isCheckingLogin} type="button" onClick={handleCheckLogin}>
            {isCheckingLogin ? "检查中..." : "我已扫码，重新检查"}
          </button>
        </div>
      ) : null}
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
      {run && !run.progress.cacheHit ? (
        <div className="agent-rounds">
          <div className="panel-heading">
            <h3>工具执行记录</h3>
            <span className="pill">
              {run.progress.currentRound}/{run.progress.maxRounds} 轮
            </span>
          </div>
          {run.progress.toolCalls.length > 0 ? (
            <div className="round-list">
              {run.progress.toolCalls.map((call) => (
                <article className="round-item" key={`${call.round}-${call.tool}-${call.inputSummary}`}>
                  <div className="source-result-heading">
                    <strong>第 {call.round} 轮 · {researchToolLabel(call.tool)}</strong>
                    <span className={call.status === "failed" ? "pill status-warn" : "pill"}>
                      {researchToolStatusLabel(call.status)}
                    </span>
                  </div>
                  <p className="muted">{call.inputSummary}</p>
                  <p>{call.observationSummary}</p>
                </article>
              ))}
            </div>
          ) : (
            <p className="muted">
              {run.status === "running" ? "等待 Agent 选择首个工具。" : "本次运行未执行研究工具。"}
            </p>
          )}
        </div>
      ) : null}
      {run ? (
        <span className="visually-hidden" aria-live="polite">
          {formatRunStatus(run)}，第 {run.progress.currentRound} / {run.progress.maxRounds} 轮，
          已记录 {run.sourceCount} 条来源。
        </span>
      ) : null}
    </section>
  );
}
