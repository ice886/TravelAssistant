import { ItineraryContent } from "../../api/client";
import { ActivityEditor } from "./ActivityEditor";

interface ItineraryDayCardProps {
  day: ItineraryContent["days"][number];
  currency: string;
  onActivityChange: (
    activityIndex: number,
    changes: Partial<ItineraryContent["days"][number]["activities"][number]>
  ) => void;
}

export function ItineraryDayCard({
  day,
  currency,
  onActivityChange
}: ItineraryDayCardProps) {
  return (
    <article className="day-card">
      <h3>
        第 {day.day} 天 · {day.title}
      </h3>

      {day.activities.map((activity, activityIndex) => (
        <ActivityEditor
          activity={activity}
          currency={currency}
          key={`${activity.time}-${activityIndex}`}
          onChange={(changes) => onActivityChange(activityIndex, changes)}
        />
      ))}
    </article>
  );
}
