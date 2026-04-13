"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Pin, UtensilsCrossed, Heart, Images } from "lucide-react";
import { WidgetCard } from "./WidgetCard";
import { CalendarWidget } from "./CalendarWidget";
import { CalendarFullView } from "./CalendarFullView";
import { RoutinesWidget } from "./RoutinesWidget";
import { RoutinesFullView } from "./RoutinesFullView";

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
  role?: string;
}

interface StreakInfo {
  current: number;
  longest: number;
  tier: string;
  multiplier: number;
  tierIcon: string;
  flameFrom: string;
  flameTo: string;
}

interface WidgetGridProps {
  calendarEvents?: CalendarEvent[];
  familyMembers?: FamilyMember[];
  familyId?: string;
  routines?: any[];
  rewards?: any[];
  todayCompletedTaskIds?: string[];
  pointsMap?: Record<string, number>;
  streakMap?: Record<string, StreakInfo>;
  yesterdayPerfectMap?: Record<string, boolean>;
}

export function WidgetGrid({
  calendarEvents = [],
  familyMembers = [],
  familyId,
  routines = [],
  rewards = [],
  todayCompletedTaskIds = [],
  pointsMap = {},
  streakMap = {},
  yesterdayPerfectMap = {},
}: WidgetGridProps) {
  const t = useTranslations("dashboard");
  const [fullView, setFullView] = useState<string | null>(null);
  const [fullViewKey, setFullViewKey] = useState(0);
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

  if (fullView === "routines" && familyId) {
    return (
      <RoutinesFullView
        key={fullViewKey}
        familyId={familyId}
        routines={routines}
        rewards={rewards}
        members={familyMembers as any[]}
        pointsMap={pointsMap}
        initialCompletedTaskIds={todayCompletedTaskIds}
        onBack={() => setFullView(null)}
        streakMap={streakMap}
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

      <RoutinesWidget
        routines={routines}
        completedTaskIds={todayCompletedTaskIds}
        pointsMap={pointsMap}
        members={familyMembers as any[]}
        onTap={() => { setFullViewKey((k) => k + 1); setFullView("routines"); }}
        streakMap={streakMap}
        yesterdayPerfectMap={yesterdayPerfectMap}
      />

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
