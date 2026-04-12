"use client";

import { useState } from "react";
import { TopBar } from "./TopBar";
import { WidgetGrid } from "./WidgetGrid";
import { IdleScreensaver } from "./IdleScreensaver";
import { SettingsModal } from "./SettingsModal";

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
}

interface DashboardClientProps {
  familyId: string;
  familyCode: string;
  calendarEvents: CalendarEvent[];
  familyMembers: FamilyMember[];
}

export function DashboardClient({ familyId, familyCode, calendarEvents, familyMembers }: DashboardClientProps) {
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div className="grain min-h-screen p-5 flex flex-col gap-5 relative z-10">
      <TopBar onSettingsClick={() => setShowSettings(true)} />
      <div className="flex-1 flex items-center">
        <div className="w-full">
          <WidgetGrid calendarEvents={calendarEvents} familyMembers={familyMembers} familyId={familyId} />
        </div>
      </div>
      <IdleScreensaver />
      {showSettings && (
        <SettingsModal
          familyId={familyId}
          familyCode={familyCode}
          members={familyMembers}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
