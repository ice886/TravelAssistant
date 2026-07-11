import { ItineraryActivity, ItineraryContent } from "../../api/client";

export function updateActivity(
  content: ItineraryContent,
  dayIndex: number,
  activityIndex: number,
  changes: Partial<ItineraryActivity>
): ItineraryContent {
  return {
    ...content,
    days: content.days.map((day, currentDayIndex) => {
      if (currentDayIndex !== dayIndex) {
        return day;
      }

      return {
        ...day,
        activities: day.activities.map((activity, currentActivityIndex) =>
          currentActivityIndex === activityIndex
            ? { ...activity, ...changes }
            : activity
        )
      };
    })
  };
}
