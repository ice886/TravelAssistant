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
  const [qrcode, setQrcode] = useState<XhsLoginQrcodeResponse | null>(null);
  const [isLoadingQrcode, setIsLoadingQrcode] = useState(false);
  const [isCheckingLogin, setIsCheckingLogin] = useState(false);

  useEffect(() => {
    setRun(null);
    setError(null);
    setQrcode(null);
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

  async function handleLoadQrcode() {
    setIsLoadingQrcode(true);
    setError(null);

    try {
      setQrcode(await getXhsLoginQrcode());
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
      setRun(nextRun);
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
      <button disabled={!trip || isStarting} type="button" onClick={handleStartResearch}>
        {isStarting ? "启动中..." : "启动研究"}
      </button>
      {trip ? <p className="muted">当前计划：{trip.destination}</p> : <p className="muted">先创建旅行计划。</p>}
      {run?.summary ? <p className="success-text">{run.summary}</p> : null}
      {run?.errorMessage ? <p className="error-text">{run.errorMessage}</p> : null}
      {error ? <p className="error-text">{error}</p> : null}
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
    </section>
  );
}
