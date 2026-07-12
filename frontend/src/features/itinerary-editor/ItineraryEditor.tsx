import { useEffect, useState } from "react";

import {
  generateItinerary,
  getLatestItinerary,
  ItineraryContent,
  ItineraryVersion,
  saveItinerary,
  Trip
} from "../../api/client";
import { ItineraryDayCard } from "./ItineraryDayCard";
import { updateActivity } from "./itineraryUpdates";

interface ItineraryEditorProps {
  trip: Trip | null;
}

export function ItineraryEditor({ trip }: ItineraryEditorProps) {
  const [itinerary, setItinerary] = useState<ItineraryVersion | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setItinerary(null);
    setError(null);

    if (!trip) {
      return;
    }

    getLatestItinerary(trip.id)
      .then(setItinerary)
      .catch(() => setItinerary(null));
  }, [trip]);

  async function runAction(action: () => Promise<ItineraryVersion>): Promise<void> {
    setBusy(true);
    setError(null);

    try {
      setItinerary(await action());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "行程操作失败");
    } finally {
      setBusy(false);
    }
  }

  function updateContent(update: (content: ItineraryContent) => ItineraryContent): void {
    setItinerary((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        content: update(current.content)
      };
    });
  }

  function generate(): void {
    if (trip) {
      void runAction(() => generateItinerary(trip.id));
    }
  }

  function save(): void {
    if (trip && itinerary) {
      void runAction(() => saveItinerary(trip.id, itinerary.content));
    }
  }

  return (
    <section className="panel panel--itinerary" aria-labelledby="itinerary-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">可编辑行程</p>
          <h2 id="itinerary-title">把线索串成一段旅程</h2>
          {itinerary && (
            <span className="muted">
              版本 {itinerary.version} · {formatVersionSource(itinerary.source)}
            </span>
          )}
        </div>

        <div className="button-row">
          <button className="primary-button" disabled={!trip || busy} onClick={generate} type="button">
            {generationButtonLabel(busy, Boolean(itinerary))}
          </button>
          {itinerary && (
            <button className="secondary-button" disabled={busy} onClick={save} type="button">
              保存新版本
            </button>
          )}
        </div>
      </div>

      <EmptyState trip={trip} itinerary={itinerary} error={error} />
      {busy && <p className="loading-hint" role="status">正在整理地点、时间与预算，请稍候…</p>}
      {error && <p className="error-text" role="alert">暂时没能完成操作。{error}</p>}
      {itinerary && (
        <ItineraryForm itinerary={itinerary} onContentChange={updateContent} />
      )}
    </section>
  );
}

function ItineraryForm({
  itinerary,
  onContentChange
}: {
  itinerary: ItineraryVersion;
  onContentChange: (update: (content: ItineraryContent) => ItineraryContent) => void;
}) {
  const { content } = itinerary;

  return (
    <div className="itinerary-content">
      <input
        aria-label="行程标题"
        value={content.title}
        onChange={(event) =>
          onContentChange((current) => ({ ...current, title: event.target.value }))
        }
      />
      <textarea
        aria-label="行程摘要"
        value={content.summary}
        onChange={(event) =>
          onContentChange((current) => ({ ...current, summary: event.target.value }))
        }
      />
      <p className="muted">
        预计总预算：{content.currency} {content.totalEstimatedCost}
      </p>

      <div className="day-grid">
        {content.days.map((day, dayIndex) => (
          <ItineraryDayCard
            currency={content.currency}
            day={day}
            key={day.day}
            onActivityChange={(activityIndex, changes) =>
              onContentChange((current) =>
                updateActivity(current, dayIndex, activityIndex, changes)
              )
            }
          />
        ))}
      </div>
    </div>
  );
}

function EmptyState({
  trip,
  itinerary,
  error
}: {
  trip: Trip | null;
  itinerary: ItineraryVersion | null;
  error: string | null;
}) {
  if (!trip) {
    return <p className="empty-hint">先描述想去的地方，再完成来源研究。你的行程草稿会在这里展开。</p>;
  }

  if (!itinerary && !error) {
    return <p className="empty-hint">线索准备好后，点击“生成行程”，我们会为你整理第一版可编辑草稿。</p>;
  }

  return null;
}

function formatVersionSource(source: ItineraryVersion["source"]): string {
  return source === "generated" ? "模型生成" : "手动编辑";
}

function generationButtonLabel(busy: boolean, hasItinerary: boolean): string {
  if (busy) {
    return "处理中…";
  }

  return hasItinerary ? "重新生成" : "生成行程";
}
