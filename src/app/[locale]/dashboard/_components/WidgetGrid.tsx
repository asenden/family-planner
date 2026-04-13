"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { UtensilsCrossed, Images } from "lucide-react";
import { WidgetCard } from "./WidgetCard";
import { CalendarWidget } from "./CalendarWidget";
import { CalendarFullView } from "./CalendarFullView";
import { RoutinesWidget } from "./RoutinesWidget";
import { RoutinesFullView } from "./RoutinesFullView";
import { PinboardWidget, type PinboardMessage } from "./PinboardWidget";
import { PinboardFullView } from "./PinboardFullView";
import { FeelingsWidget } from "./FeelingsWidget";
import { FeelingsFullView } from "./FeelingsFullView";

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

interface FeelingCheckin {
  id: string;
  date: string;
  feeling: "happy" | "neutral" | "sad" | "angry" | "excited";
  note?: string | null;
  member: { id: string; name: string; color: string };
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
  pinboardMessages?: PinboardMessage[];
  feelingCheckins?: FeelingCheckin[];
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
  pinboardMessages = [],
  feelingCheckins = [],
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

  if (fullView === "pinboard" && familyId) {
    return (
      <PinboardFullView
        familyId={familyId}
        initialMessages={pinboardMessages}
        members={familyMembers}
        onBack={() => setFullView(null)}
      />
    );
  }

  if (fullView === "feelings" && familyId) {
    return (
      <FeelingsFullView
        familyId={familyId}
        members={familyMembers}
        initialFeelings={feelingCheckins}
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

      <RoutinesWidget
        routines={routines}
        completedTaskIds={todayCompletedTaskIds}
        pointsMap={pointsMap}
        members={familyMembers as any[]}
        onTap={() => { setFullViewKey((k) => k + 1); setFullView("routines"); }}
        streakMap={streakMap}
        yesterdayPerfectMap={yesterdayPerfectMap}
      />

      <PinboardWidget
        messages={pinboardMessages}
        onTap={() => setFullView("pinboard")}
      />

      <WidgetCard
        title={t("widgets.meal")}
        icon={<UtensilsCrossed size={20} strokeWidth={1.8} />}
        color="#60a5fa"
        delay={200}
      >
        <p style={{ color: "var(--color-text-muted)" }}>{t("tapToOpen")}</p>
      </WidgetCard>

      <FeelingsWidget
        members={familyMembers}
        todayFeelings={feelingCheckins.filter((f) => {
          const d = new Date(f.date);
          const today = new Date();
          return (
            d.getFullYear() === today.getFullYear() &&
            d.getMonth() === today.getMonth() &&
            d.getDate() === today.getDate()
          );
        })}
        onTap={() => setFullView("feelings")}
      />

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
