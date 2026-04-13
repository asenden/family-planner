"use client";

import { useState } from "react";
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
}: DashboardClientProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [showWeather, setShowWeather] = useState(false);

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
