import { ItineraryActivity } from "../../api/client";

interface ActivityEditorProps {
  activity: ItineraryActivity;
  currency: string;
  onChange: (changes: Partial<ItineraryActivity>) => void;
}

export function ActivityEditor({ activity, currency, onChange }: ActivityEditorProps) {
  return (
    <div className="activity-editor">
      <div className="activity-line">
        <input
          aria-label="时间"
          value={activity.time}
          onChange={(event) => onChange({ time: event.target.value })}
        />
        <strong className="activity-title">{activity.title}</strong>
      </div>

      <p className="activity-meta">
        <span>{activity.location}</span><span>{activity.transport}</span><span>{currency} {activity.estimatedCost}</span>
      </p>

      <textarea
        aria-label="活动说明"
        value={activity.description}
        onChange={(event) => onChange({ description: event.target.value })}
      />

      {activity.sourceIds.length > 0 && (
        <small className="muted">引用来源：{activity.sourceIds.join("、")}</small>
      )}
    </div>
  );
}
