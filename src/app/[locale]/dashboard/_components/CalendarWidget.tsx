"use client";

import { useTranslations } from "next-intl";

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
  onTap: () => void;
}

export function CalendarWidget({ events, onTap }: CalendarWidgetProps) {
  const t = useTranslations("calendar");
  const upcoming = events.slice(0, 4);

  return (
    <button
      onClick={onTap}
      className="w-full text-left p-4 transition-transform active:scale-[0.98] cursor-pointer"
      style={{ backgroundColor: "var(--color-surface)", borderRadius: "var(--border-radius)" }}
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">📅</span>
        <span className="text-xs font-bold uppercase tracking-wide" style={{ color: "#FF6B6B" }}>
          {t("title")}
        </span>
      </div>
      <div className="text-sm space-y-2">
        {upcoming.length === 0 ? (
          <p style={{ color: "var(--color-text-muted)" }}>{t("noEvents")}</p>
        ) : (
          upcoming.map((event) => (
            <div key={event.id} className="flex items-start gap-2">
              <div className="flex gap-0.5 mt-0.5">
                {event.assignedTo.map((member) => (
                  <div key={member.name} className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: member.color }} title={member.name} />
                ))}
              </div>
              <div className="min-w-0">
                <p className="truncate font-medium" style={{ color: "var(--color-text)" }}>{event.title}</p>
                <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                  {event.allDay ? t("allDay") : new Date(event.start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </button>
  );
}
