import { AgentRunPanel } from "../features/agent-run/AgentRunPanel";
import { ItineraryEditor } from "../features/itinerary-editor/ItineraryEditor";
import { SourcesPanel } from "../features/sources/SourcesPanel";
import { TripForm } from "../features/trip-form/TripForm";

export function App() {
  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">TravelAssistant</p>
          <h1>Trip planning workbench</h1>
        </div>
        <div className="status-strip" aria-label="service status">
          <span>API pending</span>
          <span>Postgres pending</span>
          <span>XHS pending</span>
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
