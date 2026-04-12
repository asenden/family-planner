"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { WidgetCard } from "./WidgetCard";
import { CalendarWidget } from "./CalendarWidget";
import { CalendarFullView } from "./CalendarFullView";

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

interface WidgetGridProps {
  calendarEvents?: CalendarEvent[];
  familyMembers?: FamilyMember[];
  familyId?: string;
}

export function WidgetGrid({ calendarEvents = [], familyMembers = [], familyId }: WidgetGridProps) {
  const t = useTranslations("dashboard");
  const [fullView, setFullView] = useState<string | null>(null);

  if (fullView === "calendar" && familyId) {
    return (
      <CalendarFullView
        familyId={familyId}
        events={calendarEvents}
        members={familyMembers}
        onBack={() => setFullView(null)}
      />
    );
  }

  return (
    <div className="grid grid-cols-3 gap-4">
      <CalendarWidget events={calendarEvents} onTap={() => setFullView("calendar")} />

      <WidgetCard title={t("widgets.routines")} icon="✅" color="#FF922B">
        <p style={{ color: "var(--color-text-muted)" }}>{t("tapToOpen")}</p>
      </WidgetCard>
      <WidgetCard title={t("widgets.pinboard")} icon="📌" color="#6BCB77">
        <p style={{ color: "var(--color-text-muted)" }}>{t("noMessages")}</p>
      </WidgetCard>
      <WidgetCard title={t("widgets.meal")} icon="🍽" color="#4D96FF">
        <p style={{ color: "var(--color-text-muted)" }}>{t("tapToOpen")}</p>
      </WidgetCard>
      <WidgetCard title={t("widgets.feelings")} icon="💭" color="#E599F7">
        <div className="flex gap-3 text-2xl">
          <span>😊</span><span>😐</span><span>😢</span><span>😠</span><span>🤩</span>
        </div>
      </WidgetCard>
      <WidgetCard title={t("widgets.photos")} icon="🖼" color="#FFD93D">
        <p style={{ color: "var(--color-text-muted)" }}>{t("tapToOpen")}</p>
      </WidgetCard>
    </div>
  );
}
