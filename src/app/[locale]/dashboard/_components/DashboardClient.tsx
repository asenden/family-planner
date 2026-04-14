"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { TopBar } from "./TopBar";
import { WidgetGrid } from "./WidgetGrid";
import { IdleScreensaver } from "./IdleScreensaver";
import { SettingsModal } from "./SettingsModal";
import { WeatherModal } from "./WeatherModal";
import { GamificationProvider } from "./GamificationProvider";
import { CriticalHitFlash } from "./CriticalHitFlash";
import { MysterySpinWheel } from "./MysterySpinWheel";
import { ConfettiCelebration } from "./ConfettiCelebration";
import { StreakMilestoneModal } from "./StreakMilestoneModal";
import type { WeatherData } from "@/lib/weather";
import type { PinboardMessage } from "./PinboardWidget";

const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

interface CalendarEvent {
  id: string;
  title: string;
  description?: string | null;
  start: string;
  end: string;
  allDay: boolean;
  recurrence?: string | null;
  recurrenceEnd?: string | null;
  assignedTo: { id: string; name: string; color: string }[];
}

interface FamilyMember {
  id: string;
  name: string;
  color: string;
  avatar?: string | null;
  role: string;
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

interface DashboardClientProps {
  familyId: string;
  familyCode: string;
  calendarEvents: CalendarEvent[];
  familyMembers: FamilyMember[];
  weather?: WeatherData | null;
  city?: string | null;
  routines: any[];
  rewards: any[];
  todayCompletedTaskIds: string[];
  pointsMap: Record<string, number>;
  streakMap?: Record<string, StreakInfo>;
  yesterdayPerfectMap?: Record<string, boolean>;
  feelingCheckins?: FeelingCheckin[];
  pinboardMessages?: PinboardMessage[];
}

export function DashboardClient({
  familyId,
  familyCode,
  calendarEvents,
  familyMembers,
  weather,
  city,
  routines,
  rewards,
  todayCompletedTaskIds,
  pointsMap,
  streakMap = {},
  yesterdayPerfectMap = {},
  feelingCheckins = [],
  pinboardMessages = [],
}: DashboardClientProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [showWeather, setShowWeather] = useState(false);
  const router = useRouter();
  const [currentDay, setCurrentDay] = useState(() => new Date().getDate());

  // Periodic refresh every 5 minutes + immediate refresh at midnight
  useEffect(() => {
    const interval = setInterval(() => {
      const nowDay = new Date().getDate();
      if (nowDay !== currentDay) {
        // Day changed — full reload to reset tasks
        setCurrentDay(nowDay);
      }
      router.refresh();
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [router, currentDay]);

  return (
    <GamificationProvider>
      <div className="grain min-h-screen p-5 flex flex-col gap-5 relative z-10">
        <TopBar
          onSettingsClick={() => setShowSettings(true)}
          weather={weather?.current}
          onWeatherClick={weather ? () => setShowWeather(true) : undefined}
        />
        <div className="flex-1 flex items-center">
          <div className="w-full">
            <WidgetGrid
              calendarEvents={calendarEvents}
              familyMembers={familyMembers}
              familyId={familyId}
              routines={routines}
              rewards={rewards}
              todayCompletedTaskIds={todayCompletedTaskIds}
              pointsMap={pointsMap}
              streakMap={streakMap}
              yesterdayPerfectMap={yesterdayPerfectMap}
              feelingCheckins={feelingCheckins}
              pinboardMessages={pinboardMessages}
            />
          </div>
        </div>
        <IdleScreensaver />
        {showWeather && weather && (
          <WeatherModal
            weather={weather}
            city={city}
            onClose={() => setShowWeather(false)}
          />
        )}
        {showSettings && (
          <SettingsModal
            familyId={familyId}
            familyCode={familyCode}
            members={familyMembers}
            city={city}
            onClose={() => setShowSettings(false)}
          />
        )}
      </div>
      <CriticalHitFlash />
      <MysterySpinWheel />
      <ConfettiCelebration />
      <StreakMilestoneModal />
    </GamificationProvider>
  );
}
