const steps = [
  "等待小红书登录状态",
  "检索旅行来源",
  "解析地点信息",
  "生成行程方案"
];

export function AgentRunPanel() {
  return (
    <section className="panel">
      <h2>Agent 运行</h2>
      <div className="timeline">
        {steps.map((step) => (
          <div className="timeline-item" key={step}>
            <span className="pill">待开始</span>
            <p className="muted">{step}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
