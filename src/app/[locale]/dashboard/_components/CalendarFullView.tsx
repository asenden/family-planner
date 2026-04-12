"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";

interface CalendarEvent {
  id: string;
  title: string;
  description?: string | null;
  start: string;
  end: string;
  allDay: boolean;
  assignedTo: { id: string; name: string; color: string }[];
}

interface FamilyMember {
  id: string;
  name: string;
  color: string;
}

interface CalendarFullViewProps {
  familyId: string;
  events: CalendarEvent[];
  members: FamilyMember[];
  onBack: () => void;
}

type ViewMode = "day" | "week";

export function CalendarFullView({
  familyId,
  events,
  members,
  onBack,
}: CalendarFullViewProps) {
  const t = useTranslations("calendar");
  const locale = useLocale();
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showAddForm, setShowAddForm] = useState(false);

  const weekDays = getWeekDays(currentDate, locale);
  const dayEvents = viewMode === "day"
    ? getEventsForDay(events, currentDate)
    : null;

  function navigateDate(direction: number) {
    const newDate = new Date(currentDate);
    if (viewMode === "day") {
      newDate.setDate(newDate.getDate() + direction);
    } else {
      newDate.setDate(newDate.getDate() + direction * 7);
    }
    setCurrentDate(newDate);
  }

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{
          backgroundColor: "var(--color-surface)",
          borderRadius: "var(--border-radius)",
        }}
      >
        <button
          onClick={onBack}
          className="text-sm font-semibold cursor-pointer px-3 py-1"
          style={{
            color: "var(--color-primary)",
            backgroundColor: "var(--color-background)",
            borderRadius: "var(--border-radius)",
          }}
        >
          ← {t("cancel")}
        </button>

        <div className="flex items-center gap-3">
          <button onClick={() => navigateDate(-1)} className="text-lg cursor-pointer px-2">
            ‹
          </button>
          <span className="font-bold text-lg">
            {currentDate.toLocaleDateString(locale, {
              month: "long",
              year: "numeric",
              ...(viewMode === "day" && { day: "numeric", weekday: "long" }),
            })}
          </span>
          <button onClick={() => navigateDate(1)} className="text-lg cursor-pointer px-2">
            ›
          </button>
        </div>

        <div className="flex gap-1">
          {(["day", "week"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className="text-sm px-3 py-1 cursor-pointer font-semibold"
              style={{
                borderRadius: "var(--border-radius)",
                backgroundColor:
                  viewMode === mode ? "var(--color-primary)" : "var(--color-background)",
                color: viewMode === mode ? "#fff" : "var(--color-text)",
              }}
            >
              {t(`${mode}View`)}
            </button>
          ))}
        </div>
      </div>

      {/* Calendar Body */}
      <div
        className="flex-1 overflow-auto p-4"
        style={{
          backgroundColor: "var(--color-surface)",
          borderRadius: "var(--border-radius)",
        }}
      >
        {viewMode === "week" ? (
          <WeekView
            weekDays={weekDays}
            events={events}
            locale={locale}
            onDayClick={(date) => {
              setCurrentDate(date);
              setViewMode("day");
            }}
          />
        ) : (
          <DayView events={dayEvents || []} locale={locale} />
        )}
      </div>

      {/* Add Event Button */}
      <button
        onClick={() => setShowAddForm(true)}
        className="w-full py-3 text-white font-bold cursor-pointer"
        style={{
          backgroundColor: "var(--color-primary)",
          borderRadius: "var(--border-radius)",
        }}
      >
        + {t("addEvent")}
      </button>

      {/* Add Event Modal */}
      {showAddForm && (
        <AddEventForm
          familyId={familyId}
          members={members}
          date={currentDate}
          onClose={() => setShowAddForm(false)}
          onSaved={() => {
            setShowAddForm(false);
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}

function WeekView({
  weekDays,
  events,
  locale,
  onDayClick,
}: {
  weekDays: Date[];
  events: CalendarEvent[];
  locale: string;
  onDayClick: (date: Date) => void;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className="grid grid-cols-7 gap-2">
      {weekDays.map((day) => {
        const dayStr = day.toISOString().split("T")[0];
        const dayEvents = events.filter((e) => {
          const eventDay = new Date(e.start).toISOString().split("T")[0];
          return eventDay === dayStr;
        });

        const isToday = day.getTime() === today.getTime();

        return (
          <button
            key={dayStr}
            onClick={() => onDayClick(day)}
            className="text-left p-3 min-h-[120px] cursor-pointer transition-colors"
            style={{
              borderRadius: "calc(var(--border-radius) / 2)",
              backgroundColor: isToday
                ? "color-mix(in srgb, var(--color-primary) 10%, transparent)"
                : "var(--color-background)",
            }}
          >
            <div className="text-xs font-semibold mb-1" style={{ color: "var(--color-text-muted)" }}>
              {day.toLocaleDateString(locale, { weekday: "short" })}
            </div>
            <div
              className="text-lg font-bold mb-2"
              style={{ color: isToday ? "var(--color-primary)" : "var(--color-text)" }}
            >
              {day.getDate()}
            </div>
            <div className="space-y-1">
              {dayEvents.slice(0, 3).map((event) => (
                <div
                  key={event.id}
                  className="text-xs px-1.5 py-0.5 rounded truncate"
                  style={{
                    backgroundColor:
                      event.assignedTo[0]?.color
                        ? `color-mix(in srgb, ${event.assignedTo[0].color} 20%, transparent)`
                        : "var(--color-accent)",
                    color: "var(--color-text)",
                  }}
                >
                  {event.title}
                </div>
              ))}
              {dayEvents.length > 3 && (
                <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                  +{dayEvents.length - 3}
                </div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function DayView({ events, locale }: { events: CalendarEvent[]; locale: string }) {
  const t = useTranslations("calendar");

  if (events.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p style={{ color: "var(--color-text-muted)" }}>{t("noEvents")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {events.map((event) => (
        <div
          key={event.id}
          className="flex gap-3 p-3"
          style={{
            backgroundColor: "var(--color-background)",
            borderRadius: "calc(var(--border-radius) / 2)",
          }}
        >
          <div
            className="w-1 rounded-full shrink-0"
            style={{
              backgroundColor: event.assignedTo[0]?.color || "var(--color-primary)",
            }}
          />
          <div className="flex-1">
            <p className="font-semibold">{event.title}</p>
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              {event.allDay
                ? t("allDay")
                : `${formatTime(event.start, locale)} – ${formatTime(event.end, locale)}`}
            </p>
            {event.description && (
              <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>
                {event.description}
              </p>
            )}
            <div className="flex gap-1 mt-2">
              {event.assignedTo.map((m) => (
                <span
                  key={m.id}
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: `color-mix(in srgb, ${m.color} 20%, transparent)`,
                    color: m.color,
                  }}
                >
                  {m.name}
                </span>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function AddEventForm({
  familyId,
  members,
  date,
  onClose,
  onSaved,
}: {
  familyId: string;
  members: { id: string; name: string; color: string }[];
  date: Date;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("calendar");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [allDay, setAllDay] = useState(false);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    if (!title) return;
    setLoading(true);

    const dateStr = date.toISOString().split("T")[0];
    const start = allDay ? `${dateStr}T00:00:00Z` : `${dateStr}T${startTime}:00Z`;
    const end = allDay
      ? new Date(date.getTime() + 86400000).toISOString()
      : `${dateStr}T${endTime}:00Z`;

    await fetch(`/api/families/${familyId}/calendar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description: description || null,
        start,
        end,
        allDay,
        assignedTo: selectedMembers,
      }),
    });

    setLoading(false);
    onSaved();
  }

  function toggleMember(id: string) {
    setSelectedMembers((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-md p-6 mx-4"
        style={{
          backgroundColor: "var(--color-surface)",
          borderRadius: "var(--border-radius)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold mb-4">{t("addEvent")}</h2>

        <label className="block mb-1 text-sm font-semibold">{t("eventTitle")}</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full mb-3 p-2 border border-gray-200 outline-none"
          style={{ borderRadius: "calc(var(--border-radius) / 2)" }}
        />

        <label className="block mb-1 text-sm font-semibold">{t("eventDescription")}</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full mb-3 p-2 border border-gray-200 outline-none"
          style={{ borderRadius: "calc(var(--border-radius) / 2)" }}
        />

        <label className="flex items-center gap-2 mb-3 cursor-pointer">
          <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
          <span className="text-sm font-semibold">{t("eventAllDay")}</span>
        </label>

        {!allDay && (
          <div className="flex gap-3 mb-3">
            <div className="flex-1">
              <label className="block mb-1 text-sm font-semibold">{t("eventStart")}</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full p-2 border border-gray-200 outline-none"
                style={{ borderRadius: "calc(var(--border-radius) / 2)" }}
              />
            </div>
            <div className="flex-1">
              <label className="block mb-1 text-sm font-semibold">{t("eventEnd")}</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full p-2 border border-gray-200 outline-none"
                style={{ borderRadius: "calc(var(--border-radius) / 2)" }}
              />
            </div>
          </div>
        )}

        <label className="block mb-1 text-sm font-semibold">{t("eventAssignTo")}</label>
        <div className="flex flex-wrap gap-2 mb-4">
          {members.map((member) => (
            <button
              key={member.id}
              onClick={() => toggleMember(member.id)}
              className="text-sm px-3 py-1 cursor-pointer transition-all"
              style={{
                borderRadius: "var(--border-radius)",
                backgroundColor: selectedMembers.includes(member.id)
                  ? member.color
                  : "var(--color-background)",
                color: selectedMembers.includes(member.id) ? "#fff" : "var(--color-text)",
              }}
            >
              {member.name}
            </button>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2 font-semibold cursor-pointer"
            style={{
              borderRadius: "var(--border-radius)",
              backgroundColor: "var(--color-background)",
            }}
          >
            {t("cancel")}
          </button>
          <button
            onClick={handleSave}
            disabled={!title || loading}
            className="flex-1 py-2 text-white font-semibold disabled:opacity-50 cursor-pointer"
            style={{
              borderRadius: "var(--border-radius)",
              backgroundColor: "var(--color-primary)",
            }}
          >
            {loading ? "..." : t("save")}
          </button>
        </div>
      </div>
    </div>
  );
}

function getWeekDays(date: Date, _locale: string): Date[] {
  const start = new Date(date);
  const day = start.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Start on Monday
  start.setDate(start.getDate() + diff);
  start.setHours(0, 0, 0, 0);

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d;
  });
}

function getEventsForDay(events: CalendarEvent[], date: Date): CalendarEvent[] {
  const dayStr = date.toISOString().split("T")[0];
  return events.filter((e) => new Date(e.start).toISOString().split("T")[0] === dayStr);
}

function formatTime(dateStr: string, locale: string): string {
  return new Date(dateStr).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
}
