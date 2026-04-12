"use client";

import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  assignedTo: { name: string; color: string }[];
}

interface CalendarWidgetProps {
  events: CalendarEvent[];
  maxEvents?: number;
  onTap: () => void;
}

const MAX_EVENTS_DEFAULT = 10;

export function CalendarWidget({ events, maxEvents = MAX_EVENTS_DEFAULT, onTap }: CalendarWidgetProps) {
  const t = useTranslations("calendar");
  const locale = useLocale();

  // Only future events, sorted by start, limited
  const now = new Date();
  const upcoming = events
    .filter((e) => new Date(e.start) >= now || e.allDay)
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    .slice(0, maxEvents);

  // Group by date
  const grouped = groupByDate(upcoming, locale, t("today"), t("tomorrow"));

  return (
    <button
      onClick={onTap}
      className="w-full text-left p-4 transition-transform active:scale-[0.98] cursor-pointer overflow-hidden"
      style={{ backgroundColor: "var(--color-surface)", borderRadius: "var(--border-radius)" }}
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">📅</span>
        <span className="text-xs font-bold uppercase tracking-wide" style={{ color: "#FF6B6B" }}>
          {t("title")}
        </span>
      </div>
      <div className="text-sm space-y-2">
        {grouped.length === 0 ? (
          <p style={{ color: "var(--color-text-muted)" }}>{t("noEvents")}</p>
        ) : (
          grouped.map((group) => (
            <div key={group.dateKey}>
              <p
                className="text-xs font-bold uppercase tracking-wide mb-1"
                style={{ color: "var(--color-primary)" }}
              >
                {group.label}
              </p>
              <div className="space-y-1 mb-2">
                {group.events.map((event) => (
                  <div key={event.id} className="flex items-center gap-2">
                    <div className="flex gap-0.5 shrink-0">
                      {event.assignedTo.map((member) => (
                        <div
                          key={member.name}
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: member.color }}
                          title={member.name}
                        />
                      ))}
                      {event.assignedTo.length === 0 && (
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "var(--color-text-muted)" }} />
                      )}
                    </div>
                    <span
                      className="text-xs shrink-0 w-10"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      {event.allDay
                        ? t("allDay")
                        : new Date(event.start).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <span className="truncate" style={{ color: "var(--color-text)" }}>
                      {event.title}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </button>
  );
}

interface EventGroup {
  dateKey: string;
  label: string;
  events: CalendarEvent[];
}

function groupByDate(events: CalendarEvent[], locale: string, todayLabel: string, tomorrowLabel: string): EventGroup[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const groups = new Map<string, CalendarEvent[]>();

  for (const event of events) {
    const eventDate = new Date(event.start);
    eventDate.setHours(0, 0, 0, 0);
    const key = eventDate.toISOString().split("T")[0];
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(event);
  }

  return Array.from(groups.entries()).map(([dateKey, evts]) => {
    const date = new Date(dateKey + "T00:00:00");
    let label: string;

    if (date.getTime() === today.getTime()) {
      label = todayLabel;
    } else if (date.getTime() === tomorrow.getTime()) {
      label = tomorrowLabel;
    } else {
      label = date.toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" });
    }

    return { dateKey, label, events: evts };
  });
}
