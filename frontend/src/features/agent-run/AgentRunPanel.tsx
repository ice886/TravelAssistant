const steps = [
  "Waiting for XHS login status",
  "Research sources",
  "Resolve places",
  "Generate itinerary"
];

export function AgentRunPanel() {
  return (
    <section className="panel">
      <h2>Agent run</h2>
      <div className="timeline">
        {steps.map((step) => (
          <div className="timeline-item" key={step}>
            <span className="pill">Pending</span>
            <p className="muted">{step}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
