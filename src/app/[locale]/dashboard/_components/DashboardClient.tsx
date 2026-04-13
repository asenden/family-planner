"use client";

import { useState } from "react";
import { TopBar } from "./TopBar";
import { WidgetGrid } from "./WidgetGrid";
import { IdleScreensaver } from "./IdleScreensaver";
import { SettingsModal } from "./SettingsModal";
import { WeatherModal } from "./WeatherModal";
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
}

export function DashboardClient({ familyId, familyCode, calendarEvents, familyMembers, weather, city, routines, rewards, todayCompletedTaskIds, pointsMap }: DashboardClientProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [showWeather, setShowWeather] = useState(false);

  return (
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
  );
}
