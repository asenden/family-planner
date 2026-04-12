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

  const now = new Date();
  const upcoming = events
    .filter((e) => new Date(e.start) >= now || e.allDay)
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    .slice(0, maxEvents);

  const grouped = groupByDate(upcoming, locale, t("today"), t("tomorrow"));

  return (
    <button
      onClick={onTap}
      className="glass glass-hover w-full text-left p-5 cursor-pointer overflow-hidden animate-slide-up"
      style={{ borderRadius: "var(--border-radius)", animationDelay: "50ms" }}
    >
      <div className="flex items-center gap-2.5 mb-3">
        <span className="text-xl">📅</span>
        <span className="text-[11px] font-bold uppercase tracking-[0.15em]" style={{ color: "#a78bfa" }}>
          {t("title")}
        </span>
      </div>
      <div className="text-sm space-y-2.5">
        {grouped.length === 0 ? (
          <p style={{ color: "var(--color-text-muted)" }}>{t("noEvents")}</p>
        ) : (
          grouped.map((group) => (
            <div key={group.dateKey}>
              <p
                className="text-[10px] font-bold uppercase tracking-[0.12em] mb-1.5"
                style={{ color: "var(--color-secondary)" }}
              >
                {group.label}
              </p>
              <div className="space-y-1.5">
                {group.events.map((event) => (
                  <div key={event.id} className="flex items-center gap-2.5">
                    <div className="flex gap-0.5 shrink-0">
                      {event.assignedTo.length > 0 ? (
                        event.assignedTo.map((member) => (
                          <div
                            key={member.name}
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: member.color, boxShadow: `0 0 6px ${member.color}40` }}
                            title={member.name}
                          />
                        ))
                      ) : (
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: "var(--color-text-muted)" }} />
                      )}
                    </div>
                    <span
                      className="text-[11px] shrink-0 w-10 tabular-nums"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      {event.allDay
                        ? "—"
                        : new Date(event.start).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <span className="truncate text-[13px]" style={{ color: "var(--color-text)" }}>
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

function toLocalDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function groupByDate(events: CalendarEvent[], locale: string, todayLabel: string, tomorrowLabel: string): EventGroup[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const groups = new Map<string, CalendarEvent[]>();

  for (const event of events) {
    const eventDate = new Date(event.start);
    const key = toLocalDateStr(eventDate);
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
