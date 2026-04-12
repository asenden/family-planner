"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ListChecks, Pin, UtensilsCrossed, Heart, Images } from "lucide-react";
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
  const [calendarInitialDate, setCalendarInitialDate] = useState<Date | undefined>();

  if (fullView === "calendar" && familyId) {
    return (
      <CalendarFullView
        familyId={familyId}
        events={calendarEvents}
        members={familyMembers}
        initialDate={calendarInitialDate}
        onBack={() => setFullView(null)}
      />
    );
  }

  return (
    <div className="grid grid-cols-3 gap-4">
      <CalendarWidget
        events={calendarEvents}
        onTap={(dateStr) => {
          if (dateStr) {
            setCalendarInitialDate(new Date(dateStr + "T00:00:00"));
          } else {
            setCalendarInitialDate(undefined);
          }
          setFullView("calendar");
        }}
      />

      <WidgetCard
        title={t("widgets.routines")}
        icon={<ListChecks size={20} strokeWidth={1.8} />}
        color="#f59e0b"
        delay={100}
      >
        <p style={{ color: "var(--color-text-muted)" }}>{t("tapToOpen")}</p>
      </WidgetCard>

      <WidgetCard
        title={t("widgets.pinboard")}
        icon={<Pin size={20} strokeWidth={1.8} />}
        color="#34d399"
        delay={150}
      >
        <p style={{ color: "var(--color-text-muted)" }}>{t("noMessages")}</p>
      </WidgetCard>

      <WidgetCard
        title={t("widgets.meal")}
        icon={<UtensilsCrossed size={20} strokeWidth={1.8} />}
        color="#60a5fa"
        delay={200}
      >
        <p style={{ color: "var(--color-text-muted)" }}>{t("tapToOpen")}</p>
      </WidgetCard>

      <WidgetCard
        title={t("widgets.feelings")}
        icon={<Heart size={20} strokeWidth={1.8} />}
        color="#c084fc"
        delay={250}
      >
        <div className="flex gap-3 text-2xl">
          <span>😊</span><span>😐</span><span>😢</span><span>😠</span><span>🤩</span>
        </div>
      </WidgetCard>

      <WidgetCard
        title={t("widgets.photos")}
        icon={<Images size={20} strokeWidth={1.8} />}
        color="#fbbf24"
        delay={300}
      >
        <p style={{ color: "var(--color-text-muted)" }}>{t("tapToOpen")}</p>
      </WidgetCard>
    </div>
  );
}
